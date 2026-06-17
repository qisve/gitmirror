package com.gitmirror.app;

import android.Manifest;
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

    private static final String OUTPUT_DIR = "/data/data/com.termux/files/home/.gitmirror";

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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+: need MANAGE_EXTERNAL_STORAGE
            if (Environment.isExternalStorageManager()) {
                JSObject r = new JSObject();
                r.put("granted", true);
                call.resolve(r);
            } else {
                // Store call for later
                saveCall(call);
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivityForResult(intent, 9001);
            }
        } else {
            // Android 10 and below
            requestPermissionForAlias("storage", call, "storageCallback");
        }
    }

    @PermissionCallback
    private void storageCallback(PluginCall call) {
        JSObject r = new JSObject();
        boolean granted = getPermissionState("storage") == com.getcapacitor.PermissionState.GRANTED;
        r.put("granted", granted);
        call.resolve(r);
    }

    @PluginMethod
    public void run(PluginCall call) {
        String command = call.getString("command", "");
        String id = call.getString("id", UUID.randomUUID().toString().substring(0, 8));

        if (command.isEmpty()) {
            call.reject("命令不能为空");
            return;
        }

        try {
            String outputPath = OUTPUT_DIR + "/out_" + id + ".txt";

            // Build inline command: run user command, write output, mark done
            String safeCmd = command.replace("'", "'\\''");
            String fullCmd =
                "mkdir -p " + OUTPUT_DIR + " && " +
                "{ eval '" + safeCmd + "'; } > '" + outputPath + "' 2>&1; " +
                "echo __GM_DONE__ >> '" + outputPath + "'";

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

        // Try reading via Termux (since app can't directly access Termux home)
        try {
            // We need to read the file through Termux since it's in Termux's private dir
            String catCmd = "cat '" + path + "' 2>/dev/null || echo __NOT_FOUND__";
            String tmpOut = getContext().getCacheDir() + "/gm_read.txt";

            // For now, try direct read (works if storage permission is granted)
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
