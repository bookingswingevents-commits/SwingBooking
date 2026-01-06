export const emails = {
  welcomeClient: (name: string) => (`
    <div style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.6">
      <h1>Bienvenue ${name} ✨</h1>
      <p>On s'occupe de sublimer votre prochain événement avec le meilleur de la scène locale.</p>
      <p style="color:#888">— L'équipe Swing Booking</p>
    </div>
  `),
  bookingRequest: (formatTitle: string) => (`
    <div style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.6">
      <h1>Demande reçue ✅</h1>
      <p>Votre demande “${formatTitle}” est entre de bonnes mains. Notre équipe revient vers vous très vite avec une proposition élégante et claire.</p>
    </div>
  `),
  artistInvite: (stageName: string) => (`
    <div style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.6">
      <h1>Une belle date pour vous, ${stageName} 🎤</h1>
      <p>Confirmez simplement votre dispo — on s'occupe du reste.</p>
    </div>
  `),
  proposalSent: () => (`
    <div style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.6">
      <h1>Votre proposition est prête 💌</h1>
      <p>Relisez, validez — et on déroule la feuille de route.</p>
    </div>
  `),
  itineraryReady: () => (`
    <div style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.6">
      <h1>Feuille de route envoyée 🗺️</h1>
      <p>Tous les détails pratiques sont prêts pour un show sans friction.</p>
    </div>
  `),
  feedbackNudge: () => (`
    <div style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.6">
      <h1>Alors, c'était comment ? ⭐</h1>
      <p>Votre avis nous aide à parfaire chaque expérience. 30 secondes, promis.</p>
    </div>
  `),
  residencyInvite: (artistName: string, residencyName: string, link: string) => (`
    <div style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.6">
      <h1>Dispos pour une residence, ${artistName} 🎷</h1>
      <p>On vous propose une programmation en residence: <strong>${residencyName}</strong>.</p>
      <p>Cliquez pour indiquer vos semaines disponibles:</p>
      <p><a href="${link}">${link}</a></p>
      <p style="color:#888">Si le lien ne s'ouvre pas, copiez-collez l'URL dans votre navigateur.</p>
    </div>
  `),
};
