# Octopus Track para Android

Dos apps nativas (Kotlin + Jetpack Compose) que se conectan al servidor de Octopus Track, separadas
a propósito en dos `applicationId` distintos. Mantienen la línea gráfica de la web: violeta/blanco,
tipografía Inter, logo del pulpo, iconos Lucide y los mismos 15 iconos de unidad.

- **`:client` — "Octopus Track"** (`com.octopustrack.client`, ~2 MB): es lo único que instala la
  persona a la que se va a rastrear. Vincula el teléfono con un enlace o QR del panel, pide
  **consentimiento explícito** y envía la ubicación en segundo plano con un servicio en primer plano.
  Android exige mostrar un aviso permanente mientras usa la ubicación en segundo plano — con botón
  "Pausar" — así que no puede ejecutarse oculto. "Dejar de compartir" revoca el consentimiento en el
  servidor. Sin conexión guarda las posiciones en una cola y las reenvía. Sin inicio de sesión, sin panel.
- **`:manager` — "Octopus Manager"** (`com.octopustrack.manager`): lo instala quien administra la
  flota. Mapa en vivo, historial con reproducción, geocercas y alertas, comandos (solo administradores),
  cuenta, cambio de empresa y notificaciones push. Tras entrar, la estructura es la del panel web:
  cabecera violeta con empresa y secciones, panel "Mapa en vivo" con contadores, buscador y lista, y
  ficha de la unidad con las mismas métricas y acciones. No pide permisos de ubicación propios ni cámara.

Ambas comparten código mediante el módulo librería `:core` (datos, red, tema, componentes y el
repositorio/servicio del rastreador).

## Compilar

Requisitos: JDK 17 y Android SDK (compileSdk 36).

```bash
cd apps/android
export ANDROID_HOME=/ruta/al/sdk
./gradlew :core:testDebugUnitTest                        # pruebas de lógica compartida
./gradlew :client:assembleDebug :manager:assembleDebug    # APKs en client/ y manager/build/outputs/apk/debug/
./gradlew :client:recordRoborazziDebug :manager:recordRoborazziDebug   # capturas en */build/shots/
```

Servidor por defecto: `https://octopus-track.vercel.app`. Para otro servidor en cualquiera de las dos apps:
`-Poctopus.serverUrl=https://mi-empresa.com` (en Manager también se puede cambiar desde
"Iniciar sesión" → "Usar otro servidor").

### Firma de release

Crea `apps/android/keystore.properties` (no se versiona) con `storeFile`, `storePassword`, `keyAlias`, `keyPassword`
y ejecuta `./gradlew :client:assembleRelease :manager:assembleRelease`. Sin ese archivo el release sale sin firmar.
`-Poctopus.abis=arm64-v8a` limita las bibliotecas nativas (MapLibre, solo en Manager) a un ABI para un APK más chico.

### Notificaciones push (opcional, solo Manager)

Usan Firebase Cloud Messaging con **tu** proyecto de Firebase. La app Cliente no las necesita.

1. Crea un proyecto en Firebase y registra la app `com.octopustrack.manager`.
2. Copia `google-services.json` a `apps/android/manager/`. Con ese archivo la compilación activa FCM automáticamente.
3. En el servidor define la variable `FCM_SERVICE_ACCOUNT` (JSON de la cuenta de servicio, o en base64).

Sin esos pasos Manager funciona igual (mapa en vivo, historial, comandos), solo sin push.

## API que usa

`/api/mobile/{ping,login,me,switch,push,commands}` (token Bearer propio, 30 días, se invalida al cambiar la contraseña
o quitar al usuario, usado por Manager), `/api/phone/*` (consentimiento y comandos del teléfono, usado por Cliente
con el token del enlace de vinculación), más los endpoints existentes de posiciones, dispositivos, geocercas y comandos.

## Límites conocidos

- Manager: las secciones Dispositivos, Usuarios y Protocolos (administración) se abren en el navegador; no están en la app.
- Cliente: el seguimiento no se reanuda solo tras reiniciar el teléfono; hay que abrir la app.
- En algunos fabricantes hay que desactivar el ahorro de batería para la app Cliente (la app lo sugiere).
- Textos solo en español.
- Probadas con compilación, pruebas unitarias y capturas de pantalla generadas con Roborazzi; **no se han ejecutado en un teléfono ni emulador**.

## Licencias de terceros

MapLibre Native (BSD-2-Clause, solo Manager), mapa base OpenFreeMap con datos © OpenStreetMap contributors (ODbL),
Lucide (ISC), Inter (SIL OFL 1.1), OkHttp (Apache-2.0), kotlinx.serialization y coroutines (Apache-2.0),
AndroidX/Jetpack Compose (Apache-2.0), ZXing Android Embedded (Apache-2.0, solo Cliente),
Firebase Messaging (Apache-2.0, solo Manager si se activa). El código de las apps es propio.
