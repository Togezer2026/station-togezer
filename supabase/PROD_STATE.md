# État de la base de production

Une seule source de vérité : `supabase/migrations/`. Les copies `apply_*.sql` ont été
supprimées (audit du 5 juillet 2026). Chaque migration se colle telle quelle dans
Supabase → SQL Editor → Run, **dans l'ordre**, puis se coche ici.

## Vérifier l'état réel à tout moment

```bash
node scripts/etat-prod.mjs    # sonde la base (lecture seule)
node scripts/test-regles.mjs  # vérifie les 10 règles vitales (données ZZ-TEST, auto-nettoyage)
```

## Migrations appliquées

| Migration | Contenu | Appliquée | Vérifiée le |
|---|---|---|---|
| 0001 → 0016 | Schéma, RLS, moteur de réservation, admin | ✅ | 05/07/2026 (sonde) |
| 0017 | Réceptif réserve un agent | ✅ | 05/07/2026 (sonde) |
| 0018 | Messagerie agent ↔ réceptif | ✅ | 05/07/2026 (sonde) |
| 0019 | Durcissement (is_admin definer, revoke anon, taille messages) | ⬜ **À APPLIQUER** | — |

> Après application d'une migration : relancer les deux scripts ci-dessus,
> puis mettre à jour ce tableau.
