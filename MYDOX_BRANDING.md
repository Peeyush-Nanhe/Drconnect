# MyDox branding

The official name is MyDox across screens, page metadata, PWA metadata, AI prompts, consent wording, documentation and source modules. Supabase is named MyDox Staging. Eleven branded hub names were updated without changing IDs.

Capacitor and Android use `com.mydox.app`, including Java packages, app labels and the URL scheme. The launcher uses the existing medical app artwork. A matching native splash mark replaces the default Capacitor branding.

Home-visit consent has version `home-visit-v2-mydox`; earlier accepted documents remain unchanged.

Verification: TypeScript, lint, 19 local database tests, client/server builds, and Android resource/Java compilation pass. The native check completed 38 Gradle tasks with dependency warnings only.

A debug preview APK was generated successfully (65 Gradle tasks), with its MyDox label, package ID and signature verified. See [Android Studio setup](ANDROID_STUDIO.md). It connects to this PC's running server. TanStack Start emits no standalone index.html; production packaging still needs a hosted server/API and bundled mobile frontend. Release builds reject the preview configuration. Capacitor's webDir is scoped to client assets so server source is not packaged.

Applied migration files, their hashes and names, internal legacy data/storage identifiers, original source-archive names, and the exact demo email addresses chosen by the owner remain compatibility/provenance records. Other external projects were not rebranded.
