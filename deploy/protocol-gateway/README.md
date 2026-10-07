# Gateway de protocolos (opcional)

Octopus Track decodifica de forma nativa GT06, Teltonika, TK103, GPS103 (Coban),
H02, Meitrack, OsmAnd y su protocolo `$POS`. Para cualquier otra marca puedes
ejecutar un **servidor de protocolos de código abierto** que reciba los equipos
y reenvíe cada posición en JSON (`{ position, device }`) a:

```
POST https://<tu-app>/api/ingest/gateway
X-Ingest-Token: <INGEST_TOKEN>
```

Una opción consolidada es **Traccar** (licencia Apache 2.0, uso comercial
permitido), que decodifica más de 200 protocolos. Octopus Track no incluye ni
redistribuye su código: se ejecuta como servicio independiente con su imagen
oficial y su propia licencia. El `docker-compose.yml` de esta carpeta es un
ejemplo; revisa la documentación oficial de su configuración de reenvío
("forward") para tu versión.

El `uniqueId` de cada equipo en ese servidor debe coincidir con el IMEI
registrado en Octopus Track.
