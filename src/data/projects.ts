export interface Project {
  name: string;
  description: string;
  tags: string[];
  repo: string;
  category: 'ia' | 'dev';
  featured?: boolean;
}

const GH = 'https://github.com/Staramper';

export const projects: Project[] = [
  {
    name: 'Claude ML MCP',
    description:
      'Servidor MCP que conecta Claude con la API de Mercado Libre / Mercado Ads: consulta y administra campañas publicitarias hablando en lenguaje natural.',
    tags: ['IA', 'MCP', 'TypeScript', 'Docker', 'OAuth'],
    repo: `${GH}/Claude-ML-MCP`,
    category: 'ia',
    featured: true,
  },
  {
    name: 'Motomex API Web',
    description: 'API y servicios web en Python para integrar los sistemas de operación de Motomex.',
    tags: ['Python', 'API', 'Integraciones'],
    repo: `${GH}/Motomex-API-web`,
    category: 'ia',
    featured: true,
  },
  {
    name: 'SDS',
    description: 'Plataforma de control de seguridad para empleados integrada con un dispositivo IoT.',
    tags: ['IoT', 'Automatización', 'Web'],
    repo: `${GH}/SDS`,
    category: 'ia',
  },
  {
    name: 'Az-Insight',
    description: 'Plataforma con un recorrido 3D interactivo desarrollada para AstraZeneca.',
    tags: ['PHP', '3D', 'Web'],
    repo: `${GH}/Az-Insight`,
    category: 'dev',
  },
  {
    name: 'Cinemapedia',
    description: 'Una enciclopedia de películas: todo lo que necesitas saber de los últimos estrenos en una sola app.',
    tags: ['Flutter', 'Dart', 'Mobile'],
    repo: `${GH}/Cinemapedia`,
    category: 'dev',
  },
  {
    name: 'Running',
    description: 'Aplicación móvil nativa para Android enfocada en actividad física.',
    tags: ['Kotlin', 'Android'],
    repo: `${GH}/Running2`,
    category: 'dev',
  },
  {
    name: 'YOUT',
    description: 'Proyecto de ventas para la comunidad de la UTD.',
    tags: ['PHP', 'Web'],
    repo: `${GH}/YOUT`,
    category: 'dev',
  },
  {
    name: 'UJED',
    description: 'Plataforma de ventas para la UJED.',
    tags: ['PHP', 'Web'],
    repo: `${GH}/UJED`,
    category: 'dev',
  },
];

export const services = [
  {
    icon: 'agent',
    title: 'Agentes y asistentes de IA',
    description:
      'Conecto modelos de lenguaje con herramientas reales mediante tool use y servidores MCP, para que la IA consulte datos y ejecute acciones, no sólo responda.',
    tags: ['LLMs', 'MCP', 'Claude'],
  },
  {
    icon: 'flow',
    title: 'Automatización de procesos',
    description:
      'Diseño flujos que eliminan trabajo manual y repetitivo: disparadores, aprobaciones, reportes y notificaciones que corren solos.',
    tags: ['n8n', 'Workflows', 'Webhooks'],
  },
  {
    icon: 'plug',
    title: 'Integraciones y APIs',
    description:
      'Uno marketplaces, CRMs, ERPs y servicios internos para que la información fluya entre sistemas sin capturas dobles.',
    tags: ['REST', 'OAuth', 'Python'],
  },
  {
    icon: 'data',
    title: 'Datos e IA aplicada',
    description:
      'Extracción, clasificación y análisis de información con IA para convertir datos dispersos en decisiones y métricas accionables.',
    tags: ['Python', 'Datos', 'Prompting'],
  },
];

export const stack = [
  { group: 'IA y agentes', items: ['Claude', 'LLMs', 'MCP', 'Tool use', 'Prompt engineering'] },
  { group: 'Automatización', items: ['n8n', 'Python', 'Webhooks', 'REST APIs', 'Docker'] },
  { group: 'Desarrollo', items: ['TypeScript', 'JavaScript', 'PHP', 'Laravel', 'Vue.js', 'Astro', 'Flutter', 'Kotlin'] },
  { group: 'Creativo', items: ['Three.js', 'Blender', 'Impresión 3D', 'Edición de video'] },
];
