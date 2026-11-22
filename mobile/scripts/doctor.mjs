import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
const run=cmd=>spawnSync(cmd[0],cmd.slice(1),{encoding:'utf8'});
const xcode=run(['xcodebuild','-version']),java=run(['java','-version']);
const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||`${process.env.HOME}/Library/Android/sdk`;
const checks=[['Node 22+',Number(process.versions.node.split('.')[0])>=22],['Xcode 26+',xcode.status===0&&/Xcode (2[6-9]|[3-9]\d)/.test(xcode.stdout)],['Java runtime',java.status===0],['Android SDK',existsSync(sdk)],['Android project',existsSync('android/app')],['iOS project',existsSync('ios/App')]];
for(const [name,ok]of checks)console.log(`${ok?'OK':'MISSING'} ${name}`);
if(checks.some(([,ok])=>!ok))process.exitCode=1;
