import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de cookies" };

export default function CookiesPage() {
  return (
    <>
      <h1>Política de cookies</h1>
      <p>
        Octopus Track utiliza únicamente almacenamiento estrictamente necesario para funcionar. No usamos cookies de
        analítica, publicidad ni de terceros, por lo que no es necesario un banner de consentimiento.
      </p>
      <table>
        <thead>
          <tr><th>Nombre</th><th>Tipo</th><th>Finalidad</th><th>Duración</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>octopus_session</code></td>
            <td>Cookie técnica (HttpOnly)</td>
            <td>Mantener la sesión iniciada de forma segura</td>
            <td>7 días</td>
          </tr>
          <tr>
            <td><code>octopus_tracker</code></td>
            <td>Almacenamiento local del navegador</td>
            <td>Recordar en el teléfono vinculado el enlace de seguimiento aceptado</td>
            <td>Hasta que deje de compartir</td>
          </tr>
        </tbody>
      </table>
      <p>Puede eliminarlas desde la configuración de su navegador; si lo hace tendrá que volver a iniciar sesión.</p>
    </>
  );
}
