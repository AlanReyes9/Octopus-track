import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Aviso de privacidad</h1>
      <p className="text-muted-foreground">
        Este aviso explica cómo se tratan los datos personales en Octopus Track, conforme a la legislación de protección
        de datos aplicable (en México, la Ley Federal de Protección de Datos Personales en Posesión de los Particulares;
        en otras jurisdicciones, normas equivalentes como el RGPD).
      </p>

      <h2>1. Responsable</h2>
      <p>
        <strong>{LEGAL.company}</strong>, con domicilio en {LEGAL.address}, es responsable del tratamiento de los datos
        de las cuentas de la plataforma. Contacto de privacidad: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>
      <p>
        Respecto a la ubicación de vehículos y teléfonos que cada empresa cliente registra, la empresa cliente es la
        responsable y Octopus Track actúa como <strong>encargado</strong> que trata los datos por su cuenta y según
        sus instrucciones.
      </p>

      <h2>2. Datos que tratamos</h2>
      <ul>
        <li><strong>Cuenta:</strong> nombre, correo electrónico, contraseña (almacenada solo como hash bcrypt), rol y empresa.</li>
        <li><strong>Equipos GPS:</strong> identificador (IMEI), posición geográfica, velocidad, rumbo, estado de encendido y fecha/hora.</li>
        <li><strong>Teléfonos vinculados:</strong> posición geográfica mientras la persona comparte su ubicación, nombre que indica al aceptar, fecha de aceptación o revocación y tipo de navegador.</li>
        <li><strong>Notificaciones:</strong> si las activas, la dirección de suscripción push que genera tu navegador (no incluye datos personales) para enviarte alertas.</li>
        <li><strong>Técnicos:</strong> registros de acceso y errores necesarios para la seguridad del servicio.</li>
      </ul>
      <p>No tratamos datos personales sensibles ni usamos los datos con fines publicitarios. No vendemos datos.</p>

      <h2>3. Finalidades</h2>
      <ul>
        <li>Prestar el servicio de localización, historial de rutas, geocercas y comandos remotos.</li>
        <li>Autenticar usuarios y proteger la plataforma frente a accesos no autorizados.</li>
        <li>Atender solicitudes de soporte y de ejercicio de derechos.</li>
      </ul>

      <h2>4. Consentimiento para localizar teléfonos</h2>
      <p>
        Un teléfono solo se localiza si la persona que lo porta abre el enlace de vinculación, lee qué empresa verá su
        ubicación y <strong>acepta expresamente</strong>. Puede dejar de compartir en cualquier momento con el botón
        &laquo;Dejar de compartir&raquo;, que revoca el consentimiento de inmediato. El sistema del teléfono muestra
        siempre cuándo se está usando la ubicación. Si además configuras una app de rastreo en segundo plano con tu
        URL personal, esa app (de un tercero, con su propia política) envía la ubicación aunque bloquees el teléfono,
        mostrando el aviso del sistema; al revocar el consentimiento la URL deja de aceptar datos. Queda prohibido usar
        la plataforma para localizar a personas sin su conocimiento.
      </p>

      <h2>5. Conservación</h2>
      <p>
        Las posiciones y eventos de geocercas se eliminan automáticamente a los <strong>{LEGAL.retentionDays} días</strong>.
        Los datos de cuenta se conservan mientras la cuenta esté activa y se eliminan al darla de baja, salvo obligación
        legal de conservarlos.
      </p>

      <h2>6. Proveedores y transferencias</h2>
      <p>Para prestar el servicio usamos proveedores que tratan datos por nuestra cuenta, bajo contrato:</p>
      <table>
        <thead>
          <tr><th>Proveedor</th><th>Uso</th><th>Ubicación</th></tr>
        </thead>
        <tbody>
          <tr><td>Vercel Inc.</td><td>Alojamiento de la aplicación web</td><td>Estados Unidos</td></tr>
          <tr><td>Neon Inc. (vía Vercel)</td><td>Base de datos</td><td>Estados Unidos</td></tr>
          <tr><td>OpenFreeMap</td><td>Teselas del mapa (recibe la dirección IP del navegador)</td><td>Unión Europea</td></tr>
          <tr><td>Servicio push del navegador (Google, Mozilla, Apple)</td><td>Entrega de notificaciones cifradas de extremo a extremo</td><td>Varía</td></tr>
        </tbody>
      </table>
      <p>
        Al pulsar &laquo;Abrir en Google Maps&raquo; se abre el sitio de Google con las coordenadas seleccionadas; a
        partir de ahí aplica la política de privacidad de Google.
      </p>

      <h2>7. Derechos ARCO y revocación</h2>
      <p>
        Puede solicitar el acceso, rectificación, cancelación u oposición al tratamiento de sus datos, así como revocar
        su consentimiento, escribiendo a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Responderemos en un
        máximo de 20 días hábiles. Si sus datos los registró una empresa cliente (por ejemplo, su empleador), le
        trasladaremos la solicitud y le ayudaremos a atenderla.
      </p>

      <h2>8. Seguridad</h2>
      <ul>
        <li>Conexiones cifradas (HTTPS/TLS) y contraseñas con hash bcrypt.</li>
        <li>Aislamiento de datos entre empresas y control de acceso por roles.</li>
        <li>Base de datos con seguridad a nivel de fila y credenciales de mínimo privilegio.</li>
        <li>Tokens de vinculación de teléfonos guardados solo como hash.</li>
      </ul>

      <h2>9. Cookies</h2>
      <p>
        Solo usamos una cookie técnica de sesión imprescindible para iniciar sesión. Consulte la{" "}
        <a href="/legal/cookies">política de cookies</a>.
      </p>

      <h2>10. Cambios</h2>
      <p>Publicaremos cualquier cambio en esta página indicando la fecha de actualización.</p>
    </>
  );
}
