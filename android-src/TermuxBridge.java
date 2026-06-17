package com.gitmirror.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Environment;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.util.UUID;

@CapacitorPlugin(
    name = "TermuxBridge",
    permissions = {
        @Permission(alias = "storage", strings = {
            android.Manifest.permission.READ_EXTERNAL_STORAGE,
            android.Manifest.permission.WRITE_EXTERNAL_STORAGE
        })
    }
)
public class TermuxBridge extends Plugin {
    private static final String BASE_DIR =
        Environment.getExternalStorageDirectory().getAbsolutePath() + "/gitmirror";

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
        requestPermissionForAlias("storage", call, "storageCallback");
    }

    @PermissionCallback
    private void storageCallback(PluginCall call) {
        JSObject r = new JSObject();
        boolean granted = getPermissionState("storage") == com.getcapacitor.PermissionState.GRANTED;
        r.put("granted", granted);
        if (granted) {
            new File(BASE_DIR + "/scripts").mkdirs();
            new File(BASE_DIR + "/out").mkdirs();
        }
        call.resolve(r);
    }

    @PluginMethod
    public void run(PluginCall call) {
        String command = call.getString("command", "");
        String id = call.getString("id", UUID.randomUUID().toString().substring(0, 8));
        if (command.isEmpty()) { call.reject("命令不能为空"); return; }
        try {
            new File(BASE_DIR + "/scripts").mkdirs();
            new File(BASE_DIR + "/out").mkdirs();
            String scriptPath = BASE_DIR + "/scripts/cmd_" + id + ".sh";
            String outputPath = BASE_DIR + "/out/out_" + id + ".txt";
            new File(outputPath).delete();
            String safeCmd = command.replace("'", "'\\''");
            String script =
                "#!/data/data/com.termux/files/usr/bin/bash\n" +
                "export PATH=/data/data/com.termux/files/usr/bin:$PATH\n" +
                "cd ~\n" +
                "{ eval '" + safeCmd + "'; } > '" + outputPath + "' 2>&1\n" +
                "echo __GM_DONE__ >> '" + outputPath + "'\n" +
                "rm -f '" + scriptPath + "'\n";
            File sf = new File(scriptPath);
            FileOutputStream fos = new FileOutputStream(sf);
            fos.write(script.getBytes("UTF-8"));
            fos.flush();
            fos.close();
            sf.setExecutable(true, false);
            Intent intent = new Intent();
            intent.setClassName("com.termux", "com.termux.app.RunCommandService");
            intent.setAction("com.termux.RUN_COMMAND");
            intent.putExtra("com.termux.RUN_COMMAND_PATH", "/data/data/com.termux/files/usr/bin/bash");
            intent.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", new String[]{ scriptPath });
            intent.putExtra("com.termux.RUN_COMMAND_BACKGROUND", true);
            intent.putExtra("com.termux.RUN_COMMAND_SESSION_ACTION", 1);
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
            ret.put("scriptPath", scriptPath);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("执行失败: " + e.getMessage());
        }
    }

    @PluginMethod
    public void readOutput(PluginCall call) {
        String path = call.getString("path", "");
        JSObject ret = new JSObject();
        if (path.isEmpty()) { ret.put("ready", false); ret.put("content", ""); call.resolve(ret); return; }
        try {
            File f = new File(path);
            if (!f.exists() || f.length() == 0) { ret.put("ready", false); ret.put("content", ""); call.resolve(ret); return; }
            StringBuilder sb = new StringBuilder();
            BufferedReader br = new BufferedReader(new FileReader(f));
            String line;
            while ((line = br.readLine()) != null) { sb.append(line).append("\n"); }
            br.close();
            String content = sb.toString();
            boolean ready = content.contains("__GM_DONE__");
            if (ready) { content = content.replace("__GM_DONE__", "").trim(); }
            ret.put("ready", ready);
            ret.put("content", content);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("ready", false);
            ret.put("content", "");
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }
}
