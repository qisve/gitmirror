package com.gitmirror.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(
    name = "TermuxBridge",
    permissions = {
        @Permission(alias = "storage", strings = {
            Manifest.permission.READ_EXTERNAL_STORAGE,
            Manifest.permission.WRITE_EXTERNAL_STORAGE
        })
    }
)
public class TermuxBridge extends Plugin {

    private static final String SHARED_DIR =
        Environment.getExternalStorageDirectory().getAbsolutePath() + "/GitMirror";
    private static final String TERMUX_PERM = "com.termux.permission.RUN_COMMAND";
    private static final int PERM_REQUEST_CODE = 9002;

    @PluginMethod
    public void checkTermux(PluginCall call) {
        JSObject r = new JSObject();
        try {
            getContext().getPackageManager().getPackageInfo("com.termux", 0);
            r.put("installed", true);
        } catch (PackageManager.NameNotFoundException e) {
            r.put("installed", false);
        }
        call.resolve(r);
    }

    @PluginMethod
    public void requestStorage(PluginCall call) {
        // Also request Termux permission at the same time
        requestTermuxPermission();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (Environment.isExternalStorageManager()) {
                ensureDirs();
                JSObject r = new JSObject();
                r.put("granted", true);
                call.resolve(r);
            } else {
                saveCall(call);
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivityForResult(intent, 9001);
            }
        } else {
            requestPermissionForAlias("storage", call, "storageCallback");
        }
    }

    @PermissionCallback
    private void storageCallback(PluginCall call) {
        boolean granted = getPermissionState("storage") == com.getcapacitor.PermissionState.GRANTED;
        if (granted) ensureDirs();
        requestTermuxPermission();
        JSObject r = new JSObject();
        r.put("granted", granted);
        call.resolve(r);
    }

    private void requestTermuxPermission() {
        try {
            Activity activity = getActivity();
            if (activity == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (activity.checkSelfPermission(TERMUX_PERM) != PackageManager.PERMISSION_GRANTED) {
                    List<String> perms = new ArrayList<>();
                    perms.add(TERMUX_PERM);
                    // Also request storage if needed
                    if (activity.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                        != PackageManager.PERMISSION_GRANTED) {
                        perms.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
                    }
                    activity.requestPermissions(perms.toArray(new String[0]), PERM_REQUEST_CODE);
                }
            }
        } catch (Exception e) {
            // Silently fail — user can grant via settings
        }
    }

    private void ensureDirs() {
        new File(SHARED_DIR + "/out").mkdirs();
    }

    @PluginMethod
    public void run(PluginCall call) {
        String command = call.getString("command", "");
        String id = call.getString("id", UUID.randomUUID().toString().substring(0, 8));

        if (command.isEmpty()) {
            call.reject("命令不能为空");
            return;
        }

        // Check Termux permission first
        Activity activity = getActivity();
        if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (activity.checkSelfPermission(TERMUX_PERM) != PackageManager.PERMISSION_GRANTED) {
                requestTermuxPermission();
                call.reject("缺少 Termux 权限，请在弹出的权限窗口中点击允许");
                return;
            }
        }

        try {
            ensureDirs();
            String outputPath = SHARED_DIR + "/out/out_" + id + ".txt";
            String termuxPath = "/sdcard/GitMirror/out/out_" + id + ".txt";
            new File(outputPath).delete();

            String safeCmd = command.replace("'", "'\\''");
            String fullCmd =
                "mkdir -p /sdcard/GitMirror/out && " +
                "{ eval '" + safeCmd + "'; } > '" + termuxPath + "' 2>&1; " +
                "echo __GM_DONE__ >> '" + termuxPath + "'";

            Intent intent = new Intent();
            intent.setClassName("com.termux", "com.termux.app.RunCommandService");
            intent.setAction("com.termux.RUN_COMMAND");
            intent.putExtra("com.termux.RUN_COMMAND_PATH",
                "/data/data/com.termux/files/usr/bin/bash");
            intent.putExtra("com.termux.RUN_COMMAND_ARGUMENTS",
                new String[]{ "-c", fullCmd });
            intent.putExtra("com.termux.RUN_COMMAND_BACKGROUND", true);

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    getContext().startForegroundService(intent);
                } else {
                    getContext().startService(intent);
                }
            } catch (IllegalStateException e) {
                getContext().startService(intent);
            }

            JSObject ret = new JSObject();
            ret.put("sent", true);
            ret.put("outputPath", outputPath);
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("执行失败: " + e.getMessage());
        }
    }

    @PluginMethod
    public void readOutput(PluginCall call) {
        String path = call.getString("path", "");
        JSObject ret = new JSObject();

        if (path.isEmpty()) {
            ret.put("ready", false);
            ret.put("content", "");
            call.resolve(ret);
            return;
        }

        try {
            File f = new File(path);
            if (f.exists() && f.length() > 0) {
                StringBuilder sb = new StringBuilder();
                BufferedReader br = new BufferedReader(new FileReader(f));
                String line;
                while ((line = br.readLine()) != null) {
                    sb.append(line).append("\n");
                }
                br.close();

                String content = sb.toString();
                boolean ready = content.contains("__GM_DONE__");
                if (ready) {
                    content = content.replace("__GM_DONE__", "").trim();
                }
                ret.put("ready", ready);
                ret.put("content", content);
            } else {
                ret.put("ready", false);
                ret.put("content", "");
            }
        } catch (Exception e) {
            ret.put("ready", false);
            ret.put("content", "");
            ret.put("error", e.getMessage());
        }
        call.resolve(ret);
    }
}
