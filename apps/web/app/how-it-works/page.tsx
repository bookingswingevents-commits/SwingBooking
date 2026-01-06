// app/how-it-works/page.tsx
import Link from 'next/link';

export const metadata = {
  title: 'Comment ça marche ? – Swing Booking',
  description:
    "Comprenez en quelques minutes comment Swing Booking simplifie la programmation musicale entre établissements et artistes.",
};

export default function HowItWorksPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Header */}
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
          Plateforme de mise en relation
        </p>
        <h1 className="text-3xl md:text-4xl font-bold">
          Comment fonctionne Swing Booking&nbsp;?
        </h1>
        <p className="text-slate-600 max-w-2xl">
          Swing Booking connecte des établissements et des artistes autour d&apos;une idée
          simple&nbsp;: vous choisissez un format d&apos;événement, nous trouvons les
          artistes adaptés, vous validez en quelques clics. Le tout avec un suivi
          professionnel (feuilles de route, communication, administratif).
        </p>
      </header>

      {/* Étapes principales */}
      <section className="grid md:grid-cols-2 gap-6">
        <article className="border rounded-2xl p-5 bg-white space-y-3">
          <h2 className="text-lg font-semibold">1. Choisir ou créer un événement</h2>
          <p className="text-sm text-slate-600">
            Vous accédez à un catalogue de formats (DJ, solo, duo, trio, jazz,
            etc.). Vous pouvez sélectionner un format existant ou créer un événement sur
            mesure. Vous renseignez simplement la date, l&apos;horaire, l&apos;adresse et
            quelques infos pratiques.
          </p>
          <p className="text-sm text-slate-600">
            Tous les détails sont enregistrés dans votre espace, ce qui vous fait gagner
            du temps pour les événements suivants.
          </p>
        </article>

        <article className="border rounded-2xl p-5 bg-white space-y-3">
          <h2 className="text-lg font-semibold">2. Matching automatique avec les artistes</h2>
          <p className="text-sm text-slate-600">
            Une fois votre demande envoyée, Swing Booking interroge automatiquement les
            artistes compatibles avec votre format et vos contraintes (style, formation,
            budget, etc.).
          </p>
          <p className="text-sm text-slate-600">
            Les artistes indiquent s&apos;ils sont disponibles et, le cas échéant, leur
            tarif ainsi que le mode de rémunération (cachets via GUSO, association,
            entreprise, facture).
          </p>
        </article>

        <article className="border rounded-2xl p-5 bg-white space-y-3">
          <h2 className="text-lg font-semibold">3. Réception de la proposition</h2>
          <p className="text-sm text-slate-600">
            Vous recevez une proposition complète avec un ou plusieurs artistes
            potentiellement disponibles pour votre événement&nbsp;: fiche artistique,
            liens pour écouter, visuels, conditions financières.
          </p>
          <p className="text-sm text-slate-600">
            Si la proposition vous convient, vous la validez. Sinon, vous pouvez demander
            une nouvelle proposition (dans la limite prévue par votre pack).
          </p>
        </article>

        <article className="border rounded-2xl p-5 bg-white space-y-3">
          <h2 className="text-lg font-semibold">4. Validation &amp; feuille de route</h2>
          <p className="text-sm text-slate-600">
            À la validation, une feuille de route est générée pour l&apos;artiste et pour
            vous. La date est ajoutée à vos calendriers et à celui de l&apos;artiste.
          </p>
          <p className="text-sm text-slate-600">
            Vous accédez aussi aux éléments de communication (texte de présentation,
            visuels, informations techniques) que vous pouvez utiliser directement ou
            transmettre à l&apos;agence partenaire Tout Passe Par Là.
          </p>
        </article>
      </section>

      {/* Rémunération & administratif */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Gestion de la rémunération</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="border rounded-2xl p-4 bg-white">
            <h3 className="font-semibold mb-1">Artiste intermittent</h3>
            <p className="text-sm text-slate-600">
              Si l&apos;artiste est intermittent, la rémunération se fait en
              cachets&nbsp;: vous pouvez gérer cela via le GUSO, ou passer par
              l&apos;association partenaire Un Dimanche au Bord de l&apos;Eau, qui peut
              prendre en charge cette partie administrative.
            </p>
          </div>
          <div className="border rounded-2xl p-4 bg-white">
            <h3 className="font-semibold mb-1">Association ou entreprise</h3>
            <p className="text-sm text-slate-600">
              Si l&apos;artiste est en association ou en entreprise, il vous adresse sa
              facture directement. Swing Booking vous aide à centraliser les
              informations, mais la relation contractuelle reste entre vous et
              l&apos;artiste ou la structure.
            </p>
          </div>
          <div className="border rounded-2xl p-4 bg-white">
            <h3 className="font-semibold mb-1">Commission &amp; abonnements</h3>
            <p className="text-sm text-slate-600">
              L&apos;accès à la plateforme est gratuit pour une première demande
              (mode découverte). Ensuite, vous choisissez un pack (Starter/Pro/Premium)
              ou l&apos;option “gestion complète” selon vos besoins.
            </p>
          </div>
        </div>
      </section>

      {/* Packs & fonctionnement long terme */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Vos packs &amp; les artistes débloqués</h2>
        <p className="text-sm text-slate-600">
          Quel que soit le pack, à chaque fois que vous validez un événement avec un
          artiste via Swing Booking, la fiche de cet artiste est débloquée dans votre
          espace. Il rejoint automatiquement votre catalogue d&apos;artistes
          personnel&nbsp;: vous pouvez le recontacter directement, suivre votre
          historique de collaborations et lui envoyer vos feedbacks.
        </p>
        <p className="text-sm text-slate-600">
          Les packs définissent surtout&nbsp;: le nombre d&apos;événements par mois, le
          nombre de modifications possibles (demander une nouvelle proposition) et
          l&apos;accès ou non au catalogue d&apos;artistes complet.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/subscribe" className="btn btn-primary">
            Voir les packs &amp; tarifs
          </Link>
          <Link href="/catalogue" className="btn btn-outline">
            Découvrir le catalogue d&apos;événements
          </Link>
        </div>
      </section>
    </div>
  );
}
