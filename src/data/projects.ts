export interface Project {
  name: string;
  description: string;
  tags: string[];
  repo: string;
  featured?: boolean;
}

const GH = 'https://github.com/Staramper';

export const projects: Project[] = [
  {
    name: 'Claude ML MCP',
    description:
      'Servidor MCP que conecta Claude con la API de Mercado Libre / Mercado Ads para consultar y administrar campañas en lenguaje natural.',
    tags: ['TypeScript', 'MCP', 'Docker', 'OAuth'],
    repo: `${GH}/Claude-ML-MCP`,
    featured: true,
  },
  {
    name: 'Az-Insight',
    description: 'Plataforma con un recorrido 3D interactivo desarrollada para AstraZeneca.',
    tags: ['PHP', '3D', 'Web'],
    repo: `${GH}/Az-Insight`,
    featured: true,
  },
  {
    name: 'SDS',
    description: 'Plataforma de control de seguridad para empleados integrada con un dispositivo IoT.',
    tags: ['IoT', 'Web', 'CSS'],
    repo: `${GH}/SDS`,
    featured: true,
  },
  {
    name: 'Cinemapedia',
    description: 'Una enciclopedia de películas: todo lo que necesitas saber de los últimos estrenos en una sola app.',
    tags: ['Flutter', 'Dart', 'Mobile'],
    repo: `${GH}/Cinemapedia`,
  },
  {
    name: 'Motomex API Web',
    description: 'API y servicios web para la operación de Motomex.',
    tags: ['Python', 'API'],
    repo: `${GH}/Motomex-API-web`,
  },
  {
    name: 'Running',
    description: 'Aplicación móvil nativa para Android enfocada en actividad física.',
    tags: ['Kotlin', 'Android'],
    repo: `${GH}/Running2`,
  },
  {
    name: 'YOUT',
    description: 'Proyecto de ventas para la comunidad de la UTD.',
    tags: ['PHP', 'Web'],
    repo: `${GH}/YOUT`,
  },
  {
    name: 'UJED',
    description: 'Plataforma de ventas para la UJED.',
    tags: ['PHP', 'Web'],
    repo: `${GH}/UJED`,
  },
];

export const stack = [
  { group: 'Frontend', items: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'Vue.js', 'Astro', 'Tailwind', 'Three.js'] },
  { group: 'Backend', items: ['PHP', 'Laravel', 'Python', 'Node.js', 'REST APIs'] },
  { group: 'Mobile', items: ['Flutter', 'Dart', 'Kotlin'] },
  { group: 'Creativo', items: ['Blender', 'Impresión 3D', 'Edición de video'] },
];
