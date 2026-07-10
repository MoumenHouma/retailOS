# RetailOS — Guide de démarrage

Ce guide couvre le parcours complet : créer votre compte, configurer votre premier magasin, ajouter des produits, réaliser une vente, et consulter vos premiers rapports.

## 1. Créer votre compte

Rendez-vous sur `/register` et remplissez le formulaire (raison sociale, NIF, NIS, RC, informations du propriétaire). Cette étape crée automatiquement :

- votre entreprise (tenant),
- votre premier magasin (« Magasin principal »),
- les rôles système (BUSINESS_OWNER, STORE_MANAGER, CASHIER, INVENTORY_CLERK, ACCOUNTANT),
- votre compte utilisateur, avec le rôle BUSINESS_OWNER et l'accès à ce magasin.

Connectez-vous ensuite avec l'e-mail et le mot de passe choisis.

## 2. Le tableau de bord et la liste de démarrage

À la première connexion, un bandeau « Premiers pas » apparaît sur le tableau de bord tant que les étapes suivantes ne sont pas complètes :

1. Compte créé (automatique)
2. Ajouter un magasin (si vous en avez plusieurs — voir `/multi-store` et le bouton « Nouveau magasin »)
3. Ajouter des produits
4. Enregistrer une première vente

Le bandeau disparaît automatiquement une fois toutes les étapes franchies.

## 3. Ajouter des produits

Allez dans **Produits** (menu Stock), cliquez sur « Nouveau produit ». Renseignez au minimum le nom, la catégorie, l'unité, le prix de vente et le taux de TVA. Le stock initial se gère ensuite via **Inventaire** ou par une réception de commande fournisseur.

## 4. Réaliser une première vente

Ouvrez **Point de vente** (POS), ouvrez une session de caisse, recherchez un produit (scan ou recherche), ajoutez-le au panier, encaissez le paiement. Un reçu est généré ; une facture conforme DÉCRET 05-468 peut être émise depuis la vente si le client le demande.

## 5. Consulter vos rapports

Le menu **Rapports** regroupe :

- **Rapport de ventes** et **Rapport d'inventaire** — vues d'ensemble par période/produit.
- **Rapports d'achats**, **Rapports financiers**, **Performance des employés** — un rapport par domaine.
- **Rapports programmés** — planifiez l'envoi automatique par e-mail (quotidien/hebdomadaire/mensuel) de n'importe lequel de ces rapports, au format PDF, Excel ou CSV.

Chaque rapport peut aussi être exporté à la demande via les boutons PDF/Excel/CSV en haut de page.

## 6. Les recommandations IA

Une fois quelques semaines de ventes enregistrées, la **Couche Intelligence** (menu IA) commence à produire des prévisions de demande, des suggestions de réapprovisionnement, un classement de vos fournisseurs, et des recommandations actionnables visibles depuis la cloche de notification du tableau de bord.

## 7. Ajouter d'autres magasins (multi-magasins)

Si votre activité comporte plusieurs points de vente : allez dans **Multi-magasins**, créez un nouveau magasin, puis assignez-y les utilisateurs concernés. Chaque utilisateur ne voit et n'agit que sur les magasins qui lui sont assignés (sauf le propriétaire, qui a accès à tous les magasins de son entreprise).

Pour la documentation destinée aux administrateurs (déploiement, sauvegardes, variables d'environnement), voir [`admin-guide.md`](./admin-guide.md).
