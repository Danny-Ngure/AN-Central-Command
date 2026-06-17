// Alfayo Flames crew — the women's flame crew. This is the leadership / in-charge
// roster (partial; rank-and-file to follow). Each member gets an auto-generated
// Member ID and Agent ID (FLM prefix) in the same style as the ward teams and
// Warembo. National IDs aren't supplied yet, so polling-station matching is
// deferred until they're added.

export type FlamesMember = {
  name: string;
  title?: string; // portfolio / office (Matron, Chairlady, ward, Security, …)
  phone?: string;
};

export const FLAMES_PREFIX = 'FLM';

export const FLAMES_CREW: FlamesMember[] = [
  { name: 'Lucy Agutu', title: 'Matron', phone: '0702816974' },
  { name: 'Judith Asienga', title: 'Chairlady', phone: '0754266365' },
  { name: 'Edith Kiengah', title: 'Secretary', phone: '0710251823' },
  { name: 'Mercy Okuoga', title: 'Treasurer', phone: '0708192632' },
  { name: 'Elizabeth Oloo', title: 'Kadzandani', phone: '0722772991' },
  { name: 'Elizabeth Mwatete', title: 'Frere Town', phone: '0715488749' },
  { name: 'Susan Adhiambo', title: 'Mkomani', phone: '0754591090' },
  { name: "Hawaa Musasula", title: "Ziwa La Ng'ombe", phone: '0723818052' },
  { name: 'Achola', title: 'Kidogo Basi' },
  { name: 'Winnie Meshack', title: 'Security', phone: '0790629109' },
  { name: 'Sharon Onyango', title: 'Security', phone: '0716686577' },
  { name: 'Jane', title: 'Kadzandani', phone: '0718689283' },
  { name: 'Everlyn Ngoto', title: 'Single Mothers', phone: '0708832006' },
  { name: 'Purity Grecious', title: 'Media', phone: '0706830976' },
];
