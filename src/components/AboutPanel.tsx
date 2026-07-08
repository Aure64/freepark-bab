import './AboutPanel.css';

interface AboutPanelProps {
  /** Contexte pré-rempli du signalement (destination, moment) */
  reportContext: string;
  onClose: () => void;
}

const CONTACT = 'l.birdie75@gmail.com';
const APP_URL = 'https://freepark-bab.vercel.app';

export function AboutPanel({ reportContext, onClose }: AboutPanelProps) {
  const reportHref = `mailto:${CONTACT}?subject=${encodeURIComponent(
    'FreePark BAB — signalement',
  )}&body=${encodeURIComponent(
    `Décrivez le problème (zone fausse, horaire faux, parking disparu…) :\n\n\n— Contexte auto : ${reportContext}`,
  )}`;

  const share = async () => {
    const data = {
      title: 'FreePark BAB',
      text: 'Le stationnement gratuit à Biarritz, Anglet et Bayonne, selon l’heure — essaie !',
      url: APP_URL,
    };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(APP_URL);
        alert('Lien copié !');
      }
    } catch {
      /* partage annulé */
    }
  };

  return (
    <div className="about" role="dialog" aria-label="À propos de FreePark BAB">
      <div className="about__backdrop" onClick={onClose} />
      <div className="about__panel">
        <header className="about__head">
          <h2>
            FreePark <span>BAB</span>
          </h2>
          <button className="about__close" onClick={onClose} aria-label="Fermer">✕</button>
        </header>

        <p className="about__pitch">
          Le stationnement gratuit à Biarritz, Anglet et Bayonne, selon l’heure où vous y allez.
          Gratuit, sans compte, sans pub.
        </p>

        <div className="about__actions">
          <button className="about__action about__action--primary" onClick={share}>
            Partager l’app
          </button>
          <a className="about__action" href={reportHref}>
            Signaler une erreur
          </a>
        </div>

        <h3>Fiabilité</h3>
        <p>
          Les zones viennent des données ouvertes officielles des trois communes et
          d’OpenStreetMap ; les horaires sont saisis depuis les sites des mairies. Malgré tout,
          une règle peut changer ou une rue être mal cartographiée : <strong>la signalisation
          sur place fait toujours foi</strong>. L’éditeur ne peut être tenu responsable d’un
          stationnement verbalisé.
        </p>

        <h3>Données &amp; licences</h3>
        <ul>
          <li>Zones payantes/bleues : open data des villes de Biarritz, Anglet et Bayonne (licence ouverte Etalab 2.0)</li>
          <li>Parkings et rues : © contributeurs OpenStreetMap (ODbL)</li>
          <li>Adresses : Base Adresse Nationale · Photos : Panoramax (licence ouverte)</li>
          <li>Fond de carte : OpenFreeMap / OpenMapTiles · Satellite : © Esri</li>
        </ul>

        <h3>Mentions légales</h3>
        <p>
          Site édité à titre personnel et non commercial. Contact :{' '}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Hébergement : Vercel Inc. (San Francisco,
          États-Unis). Aucune donnée personnelle n’est collectée ni stockée côté serveur ; les
          favoris restent sur votre appareil.
        </p>

        <p className="about__code">
          Code source ouvert : <a href="https://github.com/Aure64/freepark-bab" target="_blank" rel="noopener noreferrer">github.com/Aure64/freepark-bab</a>
        </p>
      </div>
    </div>
  );
}
