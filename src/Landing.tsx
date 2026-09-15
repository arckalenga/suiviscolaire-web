import {
  GraduationCap,
  ArrowRight,
  BookOpen,
  Wallet,
  MessageSquare,
  CalendarDays,
  ShieldCheck,
  Heart,
  Target,
  Instagram,
  Phone,
  Mail,
} from "lucide-react";
export function Landing({ login }: { login: () => void }) {
  return (
    <div className="public-site">
      <header className="public-header">
        <a href="#accueil" className="brand">
          <span className="brand-icon">
            <GraduationCap />
          </span>
          <span>
            Suivi<span className="blue">Scolaire</span>
            <small>UN PRODUIT ACADEXIS</small>
          </span>
        </a>
        <nav aria-label="Navigation publique">
          <a href="#vision">Vision</a>
          <a href="#mission">Mission</a>
          <a href="#produits">Produits d’Acadexis</a>
          <a href="#contacts">Contacts</a>
        </nav>
        <button className="button" onClick={login}>
          Connexion <ArrowRight size={16} />
        </button>
      </header>
      <main className="public-main">
        <section className="public-hero" id="accueil">
          <div>
            <span className="pill">ACADEXIS · L’ÉDUCATION NOUS RASSEMBLE</span>
            <h1>
              L’école connectée.
              <br />
              <em>La réussite partagée.</em>
            </h1>
            <p>
              SuiviScolaire rapproche les élèves et leurs écoles. Les résultats,
              les bulletins, les paiements et les informations importantes
              trouvent enfin leur place, dans un espace simple.
            </p>
            <div className="hero-actions">
              <button className="button" onClick={login}>
                Accéder à mon espace <ArrowRight size={18} />
              </button>
              <a className="button secondary" href="#produits">
                Découvrir SuiviScolaire
              </a>
            </div>
            <div className="hero-trust">
              <span>
                <ShieldCheck size={16} />
                Un accès adapté à chaque rôle
              </span>
              <span>
                <GraduationCap size={16} />
                Pensé pour les écoles congolaises
              </span>
            </div>
          </div>
          <div
            className="hero-illustration"
            aria-label="Aperçu des fonctionnalités scolaires"
          >
            <div className="illustration-top">
              <span className="brand-icon">
                <GraduationCap />
              </span>
              <div>
                <strong>Mon espace scolaire</strong>
                <small>Tout ce qui compte, au même endroit.</small>
              </div>
              <span className="green-dot" />
            </div>
            <div className="mock-welcome">
              <small>UNE NOUVELLE FAÇON DE SUIVRE L’ÉCOLE</small>
              <h2>
                Prêt à apprendre,
                <br />
                chaque jour.
              </h2>
              <BookOpen size={62} />
            </div>
            <div className="illustration-grid">
              {[
                [BookOpen, "Mes points"],
                [GraduationCap, "Mon bulletin"],
                [Wallet, "Mes paiements"],
                [CalendarDays, "Mon horaire"],
              ].map(([Icon, label]: any) => (
                <div key={label}>
                  <Icon size={25} />
                  <strong>{label}</strong>
                </div>
              ))}
            </div>
            <div className="floating-message">
              <MessageSquare size={22} />
              <span>
                <strong>Restons en lien.</strong>
                <small>Les nouvelles de l’école, à portée de main.</small>
              </span>
            </div>
          </div>
        </section>
        <section className="public-values">
          <article id="vision">
            <div className="value-icon">
              <Heart />
            </div>
            <span className="eyebrow">NOTRE VISION</span>
            <h2>
              Une communauté scolaire
              <br />
              qui avance ensemble.
            </h2>
            <p>
              Rendre le suivi scolaire accessible et compréhensible, pour que
              chaque élève puisse connaître ses progrès et chaque école
              accompagner sa réussite.
            </p>
          </article>
          <article id="mission">
            <div className="value-icon">
              <Target />
            </div>
            <span className="eyebrow">NOTRE MISSION</span>
            <h2>
              Simplifier le quotidien.
              <br />
              Libérer du temps pour apprendre.
            </h2>
            <p>
              Réunir la gestion des élèves, les évaluations, les bulletins et la
              communication dans un outil pratique, adapté aux besoins des
              établissements.
            </p>
          </article>
        </section>
        <section className="public-products" id="produits">
          <div className="eyebrow">LES PRODUITS D’ACADEXIS</div>
          <h2>SuiviScolaire, votre école en un seul espace.</h2>
          <p>
            De la direction à l’élève, chacun retrouve les outils qui lui sont
            utiles.
          </p>
          <div className="product-grid">
            {[
              [
                GraduationCap,
                "Pour les élèves",
                "Voir ses points, son bulletin, ses paiements, ses notifications et son horaire.",
              ],
              [
                BookOpen,
                "Pour les écoles",
                "Organiser les classes, inscrire les élèves et importer les notes depuis Excel.",
              ],
              [
                ShieldCheck,
                "Pour l’administration",
                "Créer les écoles, attribuer les accès et garder une vue d’ensemble du réseau.",
              ],
            ].map(([Icon, title, body]: any) => (
              <article key={title}>
                <Icon />
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="public-contact" id="contacts">
          <div>
            <span className="eyebrow">PARLONS DE VOTRE ÉCOLE</span>
            <h2>
              Une question ?<br />
              Acadexis vous accompagne.
            </h2>
            <p>
              Contactez-nous pour découvrir la plateforme et préparer votre
              espace scolaire.
            </p>
          </div>
          <div className="contact-links">
            <a href="mailto:contact@suiviscolaire.info">
              <Mail />
              <span>
                E-mail<strong>contact@suiviscolaire.info</strong>
              </span>
              <ArrowRight />
            </a>
            <a
              href="https://www.instagram.com/acadexis_official"
              target="_blank"
              rel="noreferrer"
            >
              <Instagram />
              <span>
                Instagram<strong>@acadexis_official</strong>
              </span>
              <ArrowRight />
            </a>
            <a href="tel:+243994234000">
              <Phone />
              <span>
                Téléphone<strong>+243 994 234 000</strong>
              </span>
              <ArrowRight />
            </a>
            <a
              href="https://wa.me/27695922534"
              target="_blank"
              rel="noreferrer"
            >
              <MessageSquare />
              <span>
                WhatsApp<strong>+27 69 592 2534</strong>
              </span>
              <ArrowRight />
            </a>
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <span>SuiviScolaire · Un produit Acadexis</span>
        <span>L’éducation, plus proche.</span>
        <button className="text-button" onClick={login}>
          Se connecter
        </button>
      </footer>
    </div>
  );
}
