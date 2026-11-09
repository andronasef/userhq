<!-- section: overview -->
## Descripción general y estructura

UserHQ ayuda a su equipo a recopilar y actuar sobre los comentarios de sus clientes. Así está estructurado su espacio de trabajo:

<cards>
- **1. Workspace (Espacio de trabajo)**: El hogar central de su equipo. Alberga a los miembros de su equipo, facturación, claves de API, webhooks y la bandeja de entrada unificada de comentarios en todos sus productos.
- **2. Products (Productos)**: Las aplicaciones o servicios individuales que crea (por ejemplo, App Web, App iOS, API). Cada producto tiene su propio tablero de comentarios, hoja de ruta, registro de cambios, categorías y personalización de marca.
- **3. Customer Portals (Portales de clientes)**: El portal con su marca que visitan sus usuarios para enviar ideas, votar por solicitudes de funciones, seguir su hoja de ruta pública y leer anuncios de versiones.
</cards>

<!-- section: roles-permissions -->
## Roles y permisos de equipo

Colabore fluidamente con todo su equipo manteniendo el control total sobre la configuración del espacio de trabajo:

<cards>
- **Workspace Owner (Propietario)**: Control total: administrar suscripciones, invitar administradores, crear claves de API, configurar webhooks y transferir la propiedad.
- **Workspace Admin (Administrador)**: Puede administrar productos, clasificar comentarios, responder oficialmente a los clientes, gestionar tarjetas de la hoja de ruta y publicar notas de lanzamiento.
- **Workspace Member (Miembro)**: Puede ver las opiniones enviadas, participar en discusiones internas del equipo y dar seguimiento a las solicitudes de los clientes.
</cards>

<!-- section: requests-inbox -->
## Solicitudes y clasificación (Triage)

Ubicada en `/dashboard/[ws]/requests`, la bandeja de entrada unificada reúne todas las propuestas de los clientes de cada producto en una sola vista de clasificación de alto rendimiento.

<cards>
- **Filtrado multidimensional**: Filtre al instante por producto, fase de estado (Pendiente, En progreso, Completado), categoría, búsqueda por palabra clave y rangos de fechas.
- **Actualizaciones de estado rápidas**: Mueva elementos entre etapas (En revisión, Planificado, En progreso, Completado) con un solo clic. Los clientes que votaron por la solicitud reciben notificaciones automáticas.
</cards>

<!-- section: comments-attention -->
## Comentarios y bandeja de atención requerida

Ubicada en `/dashboard/[ws]/comments`, esta bandeja de entrada actúa como un servicio de atención receptivo para las conversaciones de comentarios.

### Etapas de flujo de trabajo

<stages>
- **Needs Attention (Requiere atención)**: Cualquier comentario de cliente que no haya recibido una respuesta oficial del equipo. Resaltado con indicadores ámbar para que nunca se pase por alto ninguna consulta.
- **Handled (Atendido)**: Se elimina automáticamente de la cola de atención tan pronto como un miembro del equipo responde con una insignia oficial, o se marca manualmente como atendido.
</stages>

<!-- section: author-location -->
## Contacto de autores e información geográfica

Para darle a su equipo un contexto valioso sobre quién envía comentarios, las tarjetas de solicitudes y comentarios muestran detalles del autor:

- **Contacto directo por correo electrónico**: Haga clic en el botón de correo junto al nombre del autor para contactarlo rápidamente para entrevistas o preguntas de seguimiento.
- **Contexto geográfico**: Vea la ubicación aproximada del cliente (por ejemplo, `London, United Kingdom [GB]`) para comprender las tendencias geográficas de uso.
- **Privacidad por diseño**: Las direcciones de correo y ubicaciones de los autores solo son visibles para los miembros del equipo y nunca se muestran en los portales públicos.

<!-- section: customer-portals -->
## Portales públicos de clientes

Cada producto en su espacio de trabajo puede tener su propio portal público en `/[ws]/[product]`.

<cards>
- **Interruptores modulares de funciones**: Habilite o deshabilite de forma independiente el tablero de comentarios, la hoja de ruta, el registro de cambios o las preguntas frecuentes por producto.
- **Identidad visual y colores personalizados**: Personalice su portal con su logotipo, nombre de marca y un color de acento personalizado.
- **Multilingüe y RTL**: Compatibilidad con 13 idiomas con detección automática del visitante, selector de idioma y redacción de contenido localizado.
- **Cambio de idioma predeterminado**: Las traducciones existentes se promocionan a los campos principales y el texto anterior se conserva como traducción.
- **Insignias de usuario**: Reconozca a los clientes con insignias junto a sus nombres en publicaciones y comentarios, asignadas manualmente o mediante reglas de atribución.
</cards>

<!-- section: roadmap-changelog -->
## Planificación de hoja de ruta y notas de lanzamiento

<cards>
- **Hoja de ruta interactiva**: Organice el desarrollo en columnas visuales (por ejemplo, En consideración, Planificado, En progreso). Vincule comentarios directamente a las tarjetas.
- **Changelog y notas de versión**: Publique anuncios etiquetados por categoría (Nueva función, Mejora, Corrección). Notifique automáticamente a los clientes que solicitaron esas funciones.
</cards>

<!-- section: faq-system -->
## Base de conocimientos de preguntas frecuentes

Agregue preguntas frecuentes organizadas por categorías en el portal de su producto. Dar respuestas inmediatas reduce consultas repetidas y solicitudes comunes de soporte.

<!-- section: themes-push -->
## Temas visuales y alertas Web Push

UserHQ incluye cuatro temas: **Sistema**, **Claro**, **Oscuro** (azul marino profundo) y **Carboncillo** (casi negro neutro). Los miembros del equipo pueden activar alertas Web Push en `/account`.

<!-- section: api-overview -->
## API de automatización y autenticación

Conecte sistemas externos, pipelines CI/CD, Slack, Discord, Linear, GitHub o paneles internos mediante la API REST de automatización de UserHQ.

### Encabezado de autenticación

```http
Authorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

<cards>
- **Límites de velocidad**: Generoso límite de 120 solicitudes por minuto por clave de API con control de flujo automático por token-bucket.
- **Permisos con alcance**: Las claves se pueden delimitar a productos específicos y conceder permisos de lectura/escritura a recursos específicos.
</cards>

<!-- section: swagger-explorer -->
## Explorador interactivo de API

Pruebe endpoints, examine parámetros, revise esquemas de solicitud/respuesta y genere fragmentos de código listos para cURL, TypeScript y Python.

[component:swagger-explorer]

<!-- section: webhooks-hmac -->
## Webhooks y verificación de firma HMAC

UserHQ entrega eventos HTTP POST en tiempo real cuando se crean solicitudes, cambian estados o llegan comentarios. Cada entrega incluye una firma HMAC-SHA256 en el encabezado `x-userhq-signature`.

### Ejemplo de verificación HMAC en Node.js / Express

```typescript
import crypto from "crypto";

export function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedHeader = `sha256=${expectedSignature}`;
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedHeader)
  );
}
```
