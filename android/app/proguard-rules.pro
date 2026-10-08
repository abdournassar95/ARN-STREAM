# Add project specific ProGuard rules here.
-keepattributes *Annotation*
-dontwarn okio.**
-dontwarn okhttp3.**
-keepclassmembers class * {
    @kotlinx.serialization.Serializable m(...);
}
