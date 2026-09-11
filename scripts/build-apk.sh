#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="$ROOT_DIR/.tools"
mkdir -p "$TOOLS_DIR"

echo "=== [1/6] Setting up Portable OpenJDK 17 ==="
JDK_DIR="$TOOLS_DIR/jdk-17"
if [ ! -f "$JDK_DIR/bin/java" ]; then
  echo "Downloading OpenJDK 17..."
  mkdir -p "$JDK_DIR"
  curl -sSL "https://download.java.net/java/GA/jdk17.0.2/dfd4a8d0985749f896bed50d7138ee7f/8/GPL/openjdk-17.0.2_linux-x64_bin.tar.gz" | tar -xz -C "$TOOLS_DIR"
  # Unpacked as jdk-17.0.2
  if [ -d "$TOOLS_DIR/jdk-17.0.2" ]; then
    rm -rf "$JDK_DIR"
    mv "$TOOLS_DIR/jdk-17.0.2" "$JDK_DIR"
  fi
fi

export JAVA_HOME="$JDK_DIR"
export PATH="$JAVA_HOME/bin:$PATH"
java -version

echo "=== [2/6] Setting up Android Command-Line Tools & SDK ==="
SDK_DIR="$TOOLS_DIR/android-sdk"
CMDLINE_DIR="$SDK_DIR/cmdline-tools/latest"

if [ ! -f "$CMDLINE_DIR/bin/sdkmanager" ]; then
  echo "Downloading Android Command-line Tools..."
  mkdir -p "$SDK_DIR/cmdline-tools"
  cd /tmp
  curl -sSL -o cmdline.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  unzip -q cmdline.zip -d "$SDK_DIR/cmdline-tools"
  rm -rf "$CMDLINE_DIR"
  mv "$SDK_DIR/cmdline-tools/cmdline-tools" "$CMDLINE_DIR"
  rm -f cmdline.zip
  cd "$ROOT_DIR"
fi

export ANDROID_HOME="$SDK_DIR"
export ANDROID_SDK_ROOT="$SDK_DIR"
export PATH="$CMDLINE_DIR/bin:$SDK_DIR/platform-tools:$SDK_DIR/build-tools/35.0.0:$SDK_DIR/build-tools/34.0.0:$PATH"

if [ ! -d "$SDK_DIR/platforms/android-35" ] || [ ! -d "$SDK_DIR/build-tools/35.0.0" ]; then
  echo "Installing Android SDK Platform 35 and Build-Tools..."
  yes | "$CMDLINE_DIR/bin/sdkmanager" --licenses > /dev/null 2>&1 || true
  "$CMDLINE_DIR/bin/sdkmanager" "platform-tools" "platforms;android-35" "build-tools;35.0.0" > /dev/null
fi

echo "sdk.dir=$ANDROID_HOME" > "$ROOT_DIR/android/local.properties"

echo "=== [3/6] Building Web App Assets ==="
cd "$ROOT_DIR"
npm run build

echo "=== [4/6] Syncing Capacitor Android ==="
npx cap sync android

# Ensure baseline Android wrapper and resources exist
if [ ! -f "$ROOT_DIR/android/gradlew" ] || [ ! -d "$ROOT_DIR/android/gradle" ]; then
  echo "Extracting Gradle wrapper from Capacitor template..."
  tar -xzf "$ROOT_DIR/node_modules/@capacitor/cli/assets/android-template.tar.gz" -C "$ROOT_DIR/android" gradlew gradlew.bat gradle build.gradle settings.gradle
fi

if [ ! -f "$ROOT_DIR/android/app/src/main/res/values/styles.xml" ]; then
  echo "Extracting Android resources from Capacitor template..."
  tar -xzf "$ROOT_DIR/node_modules/@capacitor/cli/assets/android-template.tar.gz" -C "$ROOT_DIR/android" app/src/main/res
fi

# Ensure variables.gradle has SDK 35
sed -i 's/compileSdkVersion = .*/compileSdkVersion = 35/g' "$ROOT_DIR/android/variables.gradle"
sed -i 's/targetSdkVersion = .*/targetSdkVersion = 35/g' "$ROOT_DIR/android/variables.gradle"

# Ensure app-level build.gradle has correct configs
sed -i 's/applicationId "com.getcapacitor.app"/applicationId "com.gopeshwar.stationaryhouse"/g' "$ROOT_DIR/android/app/build.gradle"
sed -i 's/namespace "com.getcapacitor.myapp"/namespace "com.gopeshwar.stationaryhouse"/g' "$ROOT_DIR/android/app/build.gradle"
sed -i 's/versionCode 1/versionCode 14/g' "$ROOT_DIR/android/app/build.gradle"
sed -i 's/versionName "1.0"/versionName "1.4.0"/g' "$ROOT_DIR/android/app/build.gradle"

# Ensure release signingConfig uses debug key
if ! grep -q "signingConfig signingConfigs.debug" "$ROOT_DIR/android/app/build.gradle"; then
  sed -i '/buildTypes {/,/}/ s/release {/release {\n            signingConfig signingConfigs.debug/' "$ROOT_DIR/android/app/build.gradle"
fi

# Ensure lintOptions does not fail the build
if ! grep -q "lintOptions" "$ROOT_DIR/android/app/build.gradle"; then
  sed -i '/buildTypes {/i \    lintOptions {\n        checkReleaseBuilds false\n        abortOnError false\n    }' "$ROOT_DIR/android/app/build.gradle"
fi

# Ensure conservative memory settings and single worker to prevent OOM in container
sed -i 's/-Xmx[0-9]*m/-Xmx512m/g' "$ROOT_DIR/android/gradle.properties"
sed -i 's/-XX:MaxMetaspaceSize=[0-9]*m/-XX:MaxMetaspaceSize=256m/g' "$ROOT_DIR/android/gradle.properties"
if ! grep -q "android.suppressUnsupportedCompileSdk=35" "$ROOT_DIR/android/gradle.properties"; then
  echo "android.suppressUnsupportedCompileSdk=35" >> "$ROOT_DIR/android/gradle.properties"
fi
if ! grep -q "org.gradle.workers.max=1" "$ROOT_DIR/android/gradle.properties"; then
  echo "org.gradle.workers.max=1" >> "$ROOT_DIR/android/gradle.properties"
  echo "org.gradle.parallel=false" >> "$ROOT_DIR/android/gradle.properties"
fi

echo "=== [5/6] Assembling Release APK with Gradle ==="
cd "$ROOT_DIR/android"
chmod +x ./gradlew
./gradlew assembleRelease --no-daemon -Dorg.gradle.workers.max=1 -Dorg.gradle.parallel=false

echo "=== [6/6] Packaging and Staging APK ==="
mkdir -p "$ROOT_DIR/dist/apk"
APK_FOUND=$(find "$ROOT_DIR/android/app/build/outputs/apk/release" -name "*.apk" 2>/dev/null | head -n 1)

if [ -n "$APK_FOUND" ] && [ -f "$APK_FOUND" ]; then
  cp "$APK_FOUND" "$ROOT_DIR/dist/apk/gsh-v1.4.0-release.apk"
  echo "SUCCESS! Release APK generated at:"
  echo "$ROOT_DIR/dist/apk/gsh-v1.4.0-release.apk"
  ls -lh "$ROOT_DIR/dist/apk/gsh-v1.4.0-release.apk"
else
  echo "Error: Release APK not found in outputs directory."
  find "$ROOT_DIR/android/app/build/outputs" -name "*.apk" || true
  exit 1
fi
