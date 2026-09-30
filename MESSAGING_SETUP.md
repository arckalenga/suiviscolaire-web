# Activer les emails et WhatsApp de SuiviScolaire

Les rôles et la présence fonctionnent sans fournisseur de messagerie. Aucun envoi externe n’est activé par défaut. Les comptes de connexion scolaires ne créent pas de boîtes email.

## Préparer les destinataires
1. Ouvrir une école > **Envois & contacts** avec le main admin, le sous-admin ou le financier.
2. Choisir un élève ou un membre du personnel.
3. Pour un élève, saisir le nom et les coordonnées du parent/responsable autorisé. Un contact principal est enregistré par élève, même si plusieurs enfants partagent le même parent.
4. Utiliser un numéro international, par exemple +243 suivi du numéro complet. Confirmer l’accord du destinataire pour chaque canal. Décocher cet accord arrête les futurs envois de ce canal.
5. Les gestionnaires consultent l’historique et ne modifient pas les contacts.

## Email : adaptateur Resend
Créer un compte Resend, vérifier un domaine d’envoi que vous contrôlez en ajoutant les enregistrements DNS demandés, puis créer une clé autorisée à envoyer. Ne pas supprimer les enregistrements MX de votre messagerie/forwarding existant. Un sous-domaine dédié à l’envoi peut séparer ces usages.

Dans les **secrets de la fonction Supabase**, configurer :
- RESEND_API_KEY : clé privée du fournisseur.
- DELIVERY_FROM_EMAIL : adresse d’expédition validée, avec éventuellement le nom SuiviScolaire.

Ne jamais ajouter ces valeurs à GitHub, au frontend ou à une variable VITE_. Le service utilise l’[API officielle Resend](https://resend.com/docs/api-reference/emails/send-email), avec une clé d’idempotence par envoi. Un reçu PDF est joint aux emails de paiement. Les notifications de notes et communications invitent à ouvrir le compte scolaire sans exposer les points dans le message.

## WhatsApp : adaptateur Meta Cloud API
Créer/configurer un compte WhatsApp Business Platform, une application Meta et un numéro d’expédition autorisé. Un compte WhatsApp personnel ou le simple partage wa.me ne suffit pas pour cet envoi serveur.

Configurer ces secrets Supabase :
- WHATSAPP_ACCESS_TOKEN : jeton serveur doté des droits d’envoi.
- WHATSAPP_PHONE_NUMBER_ID : identifiant du numéro d’expédition, pas son numéro téléphonique.
- WHATSAPP_GRAPH_VERSION : version Graph actuellement prise en charge par votre application, sous la forme vNN.N.
- WHATSAPP_TEMPLATE_NAME : nom exact d’un modèle approuvé.
- WHATSAPP_TEMPLATE_LANGUAGE : langue exacte du modèle approuvé, par exemple fr.

Le modèle doit avoir **trois paramètres texte dans le corps**, dans cet ordre : nom du destinataire, nom de l’école, type de notification. Exemple à soumettre pour validation :
« Bonjour {{1}}, {{2}} vous informe : {{3}}. Consultez votre espace : https://suiviscolaire.info/#connexion. »
Il ne doit pas imposer de paramètres d’en-tête ni de bouton dynamique supplémentaires. Voir la [référence Meta des modèles](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/).

La notification WhatsApp ne contient pas les points et ne joint pas encore le PDF : elle annonce le document. Les élèves/parents retrouvent leurs reçus dans leur espace ; le reçu PDF peut aussi être envoyé par email. Pour les employés sans compte, utiliser l’email pour le reçu détaillé.

## Activation et test contrôlé
Une fois les identifiants et le modèle prêts, configurer **DELIVERY_ENABLED=true** dans les secrets Supabase. La fonction web-delivery est déjà déployée. Le statut « Connecté » indique que les paramètres requis sont présents, pas qu’un message a déjà été reçu.

Faire d’abord un test autorisé vers une adresse et un numéro de test dont vous contrôlez la réception. Vérifier l’email, son PDF, le WhatsApp et le journal du fournisseur avant d’utiliser des destinataires réels. Aucun message à une personne réelle n’a été envoyé pendant les tests de développement.

Les services peuvent facturer les envois ; vérifier leur offre avant activation. Aucune souscription payante n’a été effectuée.

## Utilisation et droits
- Paiements / Personnel & salaires : le **financier ou main admin** choisit « Envoyer le reçu par email » ou « Notifier par WhatsApp » sur le paiement enregistré. Le contact enregistré est utilisé directement.
- Envois & contacts > Notifier une publication : le **sous-admin ou main admin** choisit une communication ou une évaluation publiée, le canal et tous les destinataires concernés ou un seul.
- Une communication à une classe ou un élève reste limitée à ce public. Une note ne cible que les élèves avec un résultat enregistré pour cette évaluation.
- Chaque envoi revérifie l’utilisateur, le rôle, l’école, le document et le consentement côté serveur.
- Le bouton prépare un envoi immédiat ; la publication seule ne déclenche pas d’email/WhatsApp. Les notifications dans l’app et le push existant sont indépendants.
- Un envoi déjà enregistré pour le même document, sa publication, son contact et son canal n’est pas répété. Même après un refus ou une réponse incertaine, vérifier le fournisseur avant une relance administrative.
- « Accepté par le fournisseur » ne confirme pas la réception ni la lecture. Les webhooks de réception/lecture, les reprises automatiques, plusieurs contacts par élève et l’envoi du PDF en pièce jointe WhatsApp restent des améliorations futures.
