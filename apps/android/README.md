# Octopus Track para Android

App nativa (Kotlin + Jetpack Compose) que se conecta al servidor de Octopus Track.
Mantiene la línea gráfica de la web: violeta/blanco, tipografía Inter, logo del pulpo, iconos Lucide y
los mismos 15 iconos de unidad.

Dos modos en una sola app:

1. **Iniciar sesión** (propietario, administrador o cliente): mapa en vivo, historial con reproducción,
   geocercas y alertas, comandos (solo administradores), cuenta, cambio de empresa y notificaciones push.
   Tras entrar, la estructura es la del panel web: cabecera violeta con empresa y secciones,
   panel "Mapa en vivo" con contadores, buscador y lista, y ficha de la unidad con las mismas métricas y acciones.
2. **Compartir mi ubicación**: vincula el teléfono con un enlace o QR del panel, pide consentimiento explícito,
   y envía la ubicación en segundo plano con un servicio en primer plano (aviso permanente con botón Pausar).
   "Dejar de compartir" revoca el consentimiento en el servidor. Sin conexión guarda las posiciones y las reenvía.

## Compilar

Requisitos: JDK 17 y Android SDK (compileSdk 36).

```bash
cd apps/android
export ANDROID_HOME=/ruta/al/sdk
./gradlew :app:testDebugUnitTest        # pruebas
./gradlew :app:assembleDebug            # app/build/outputs/apk/debug/app-debug.apk
./gradlew :app:recordRoborazziDebug     # capturas de pantallas en app/build/shots/
```

Servidor por defecto: `https://octopus-track.vercel.app`. Para otro servidor:
`./gradlew :app:assembleDebug -Poctopus.serverUrl=https://mi-empresa.com`
(también se puede cambiar en la pantalla de inicio de sesión → "Usar otro servidor").

### Firma de release

Crea `apps/android/keystore.properties` (no se versiona) con `storeFile`, `storePassword`, `keyAlias`, `keyPassword`
y ejecuta `./gradlew :app:assembleRelease`. Sin ese archivo el release sale sin firmar.

### Notificaciones push (opcional)

Usan Firebase Cloud Messaging con **tu** proyecto de Firebase:

1. Crea un proyecto en Firebase y registra la app `com.octopustrack.app`.
2. Copia `google-services.json` a `apps/android/app/`. Con ese archivo la compilación activa FCM automáticamente.
3. En el servidor define la variable `FCM_SERVICE_ACCOUNT` (JSON de la cuenta de servicio, o en base64).

Sin esos pasos la app funciona igual (mapa en vivo, historial, comandos), solo sin push.

## API que usa

`/api/mobile/{ping,login,me,switch,push,commands}` (token Bearer propio, 30 días, se invalida al cambiar la contraseña
o quitar al usuario), más los endpoints existentes de posiciones, dispositivos, geocercas, comandos y `/api/phone/*`.

## Límites conocidos

- Las secciones Dispositivos, Usuarios y Protocolos (administración) se abren en el navegador; no están en la app.
- El seguimiento no se reanuda solo tras reiniciar el teléfono; hay que abrir la app.
- En algunos fabricantes hay que desactivar el ahorro de batería para la app (la app lo sugiere).
- Textos solo en español.
- Probada con compilación, pruebas unitarias y capturas de pantalla generadas con Roborazzi; **no se ha ejecutado en un teléfono ni emulador**.

## Licencias de terceros

MapLibre Native (BSD-2-Clause), mapa base OpenFreeMap con datos © OpenStreetMap contributors (ODbL), Lucide (ISC),
Inter (SIL OFL 1.1), OkHttp (Apache-2.0), kotlinx.serialization y coroutines (Apache-2.0), AndroidX/Jetpack Compose (Apache-2.0),
ZXing Android Embedded (Apache-2.0), Firebase Messaging (Apache-2.0, solo si se activa). El código de la app es propio.
