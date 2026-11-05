fn main() {
    // The test program on Windows needs the newer common controls
    // library, or it will not even start. The shipped app already
    // gets this through Tauri, and the two settings merge safely.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        println!(
            "cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' publicKeyToken='6595b64144ccf1df' language='*' processorArchitecture='*'"
        );
    }
    tauri_build::build()
}
