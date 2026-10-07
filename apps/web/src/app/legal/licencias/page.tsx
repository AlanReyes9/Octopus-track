import type { Metadata } from "next";

export const metadata: Metadata = { title: "Licencias y créditos" };

const SOFTWARE: [string, string, string][] = [
  ["Next.js", "MIT", "https://github.com/vercel/next.js"],
  ["React", "MIT", "https://github.com/facebook/react"],
  ["MapLibre GL JS", "BSD-3-Clause", "https://github.com/maplibre/maplibre-gl-js"],
  ["Tailwind CSS", "MIT", "https://github.com/tailwindlabs/tailwindcss"],
  ["shadcn/ui (componentes adaptados)", "MIT", "https://github.com/shadcn-ui/ui"],
  ["Radix UI", "MIT", "https://github.com/radix-ui/primitives"],
  ["Lucide (iconos)", "ISC", "https://github.com/lucide-icons/lucide"],
  ["Drizzle ORM", "Apache-2.0", "https://github.com/drizzle-team/drizzle-orm"],
  ["class-variance-authority", "Apache-2.0", "https://github.com/joe-bell/cva"],
  ["Postgres.js", "Unlicense", "https://github.com/porsager/postgres"],
  ["Fastify", "MIT", "https://github.com/fastify/fastify"],
  ["ws", "MIT", "https://github.com/websockets/ws"],
  ["ioredis", "MIT", "https://github.com/redis/ioredis"],
  ["jose", "MIT", "https://github.com/panva/jose"],
  ["Zod", "MIT", "https://github.com/colinhacks/zod"],
  ["bcrypt.js", "BSD-3-Clause", "https://github.com/dcodeIO/bcrypt.js"],
  ["node-qrcode", "MIT", "https://github.com/soldair/node-qrcode"],
  ["clsx / tailwind-merge", "MIT", "https://github.com/lukeed/clsx"],
];

export default function LicensesPage() {
  return (
    <>
      <h1>Licencias y créditos</h1>
      <p>
        El código de Octopus Track es original. Se apoya en los siguientes componentes de código abierto, todos con
        licencias permisivas que autorizan su uso comercial con atribución. Agradecemos a sus autores.
      </p>

      <h2>Software</h2>
      <table>
        <thead>
          <tr><th>Componente</th><th>Licencia</th></tr>
        </thead>
        <tbody>
          {SOFTWARE.map(([name, license, url]) => (
            <tr key={name}>
              <td><a href={url} target="_blank" rel="noreferrer">{name}</a></td>
              <td>{license}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Mapas y datos</h2>
      <ul>
        <li>
          Datos cartográficos © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">colaboradores de OpenStreetMap</a>, disponibles bajo la Open Database License (ODbL).
        </li>
        <li>
          Teselas vectoriales servidas por <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>, con esquema © <a href="https://openmaptiles.org" target="_blank" rel="noreferrer">OpenMapTiles</a>.
        </li>
        <li>
          Los enlaces &laquo;Abrir en Google Maps&raquo; usan las URL públicas documentadas por Google (Maps URLs). Google Maps
          es una marca de Google LLC; Octopus Track no está afiliado ni patrocinado por Google.
        </li>
      </ul>

      <h2>Tipografía</h2>
      <p>Inter, de Rasmus Andersson, bajo la SIL Open Font License 1.1.</p>

      <h2>Marca</h2>
      <p>
        El nombre, el logotipo del pulpo y el diseño visual de Octopus Track son originales. Otras marcas citadas
        pertenecen a sus respectivos titulares y se mencionan únicamente con fines descriptivos o de compatibilidad.
      </p>
    </>
  );
}
