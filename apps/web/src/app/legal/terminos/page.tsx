import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function TermsPage() {
  return (
    <>
      <h1>Términos y condiciones de uso</h1>
      <p className="text-muted-foreground">
        Estos términos regulan el uso de la plataforma Octopus Track (el &laquo;Servicio&raquo;), prestada por{" "}
        {LEGAL.company}. Al crear una cuenta o usar el Servicio usted los acepta.
      </p>

      <h2>1. El Servicio</h2>
      <p>
        Octopus Track permite a empresas monitorear la ubicación de sus vehículos y de teléfonos cuyos portadores
        han dado su consentimiento, consultar historiales de rutas, definir geocercas y enviar comandos a equipos
        compatibles.
      </p>

      <h2>2. Cuentas y roles</h2>
      <ul>
        <li>Los administradores de cada empresa crean usuarios y definen sus permisos.</li>
        <li>Los usuarios con rol &laquo;Cliente&raquo; solo pueden consultar las unidades que se les asignen; no pueden registrar equipos ni enviar comandos.</li>
        <li>Usted es responsable de custodiar sus credenciales y de la actividad realizada con ellas.</li>
      </ul>

      <h2>3. Uso lícito y consentimiento</h2>
      <p>Usted se obliga a usar el Servicio conforme a la ley. En particular, <strong>queda prohibido</strong>:</p>
      <ul>
        <li>Localizar a cualquier persona sin su conocimiento y consentimiento expreso, o vigilarla, acosarla o intimidarla.</li>
        <li>Instalar o vincular equipos en vehículos o teléfonos que no le pertenezcan o sobre los que no tenga autorización.</li>
        <li>Rastrear a empleados sin haberles informado previamente conforme a la legislación laboral y de protección de datos.</li>
        <li>Intentar acceder a datos de otras empresas, vulnerar la seguridad o realizar ingeniería inversa del Servicio.</li>
      </ul>
      <p>
        Como responsable de los datos de sus vehículos, conductores y teléfonos, la empresa cliente debe contar con base
        legal para el tratamiento y atender los derechos de las personas afectadas. Podemos suspender cuentas ante
        indicios de uso ilícito.
      </p>

      <h2>4. Comandos remotos</h2>
      <p>
        Los comandos (por ejemplo, bloqueo de motor) se envían bajo la exclusiva responsabilidad de quien los ordena. Por
        seguridad, el bloqueo de motor solo se permite con el vehículo detenido. La entrega depende de la cobertura,
        configuración y compatibilidad del equipo, por lo que no se garantiza su ejecución.
      </p>

      <h2>5. Disponibilidad</h2>
      <p>
        Procuramos un servicio continuo, pero la localización depende de redes de telefonía, señal GPS, terceros
        proveedores y del estado de cada equipo. El Servicio no es un sistema de emergencias ni de seguridad de vidas.
      </p>

      <h2>6. Propiedad intelectual</h2>
      <p>
        El software, diseño, logotipo y marca Octopus Track son titularidad de {LEGAL.company} o se usan con licencia.
        El Servicio incorpora componentes de código abierto bajo sus respectivas licencias, detallados en{" "}
        <a href="/legal/licencias">Licencias y créditos</a>. Las marcas de terceros mencionadas pertenecen a sus titulares
        y se citan solo a efectos descriptivos.
      </p>

      <h2>7. Responsabilidad</h2>
      <p>
        En la medida permitida por la ley, el Servicio se presta &laquo;tal cual&raquo; y no seremos responsables de
        daños indirectos, lucro cesante o pérdida de datos derivados de su uso o imposibilidad de uso, ni del uso
        ilícito que los usuarios hagan de él.
      </p>

      <h2>8. Baja</h2>
      <p>
        Puede solicitar la baja en cualquier momento escribiendo a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
        Tras la baja eliminaremos los datos conforme al <a href="/legal/privacidad">aviso de privacidad</a>.
      </p>

      <h2>9. Ley aplicable</h2>
      <p>
        Estos términos se rigen por las leyes de {LEGAL.country}. Para cualquier controversia las partes se someten a los
        tribunales de {LEGAL.jurisdiction}, salvo que la normativa de consumo disponga otra cosa.
      </p>
    </>
  );
}
