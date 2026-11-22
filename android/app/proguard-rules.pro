# Capacitor / WebView shell
-keep class com.getcapacitor.** { *; }
-keep class com.aurumassay.forensics.** { *; }

# JNI entry points
-keepclasseswithmembernames class * {
    native <methods>;
}
