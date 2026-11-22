# Quels résultats classer dans TOP1 % ?

Audit du code local du 22 novembre 2026. Le journal accepte **36 mesures actives** dans six familles. Le registre conserve aussi **10 identifiants archivés**. Le barème historique `10-three-levels` produit un palier pour 21 mesures. Avant cette révision, l’adaptateur de l’écran Classement en exposait 15 dans le pilier physique. Le code révisé expose **13 défis individuels** avec leur prochain seuil atteignable. Trois mesures actives ont des tables de population compatibles ; la poigne et le saut ont aussi un défi. Les 22 autres mesures disposent du suivi personnel comme unique comparaison dans cet écran. Le poids de corps et la taille du profil sont des données de contexte. Ils ne constituent pas des épreuves supplémentaires. [Registre](../lib/registry.ts) · [Catalogue](../lib/performanceCatalog.ts) · [Calcul v10](../lib/benchmarkGame.ts) · [Adaptateur Classement](../lib/rankExplorer.ts) · [Liste des 13 défis](../lib/challengeProgress.ts)

**Décision produit proposée.** Ouvrir en priorité 13 épreuves à une future compétition vérifiée, garder trois tests à interprétation plafonnée (VO₂ publié, équilibre et assis-debout fonctionnels), et proposer les 20 autres comme mesures personnelles facultatives hors compétition. Les 36 conservent leur historique. Un record personnel exige des essais comparables. Un identifiant actif ou un résultat saisi manuellement ne suffit pas à rejoindre un classement certifié.

**Barèmes actuels.** Les colonnes « palier 1 % effectif v10 » et le script ci-dessous conservent les anciennes règles. Les 13 épreuves ouvertes utilisent aujourd’hui la version performance-v3. La précision affichée se termine à « Top 0,01 % ou mieux ». Le premier test admissible donne un score global provisoire. Chaque nouvelle saisie admissible recalcule le score et la couverture. [Règles et unités pour chaque épreuve](PERFORMANCE_GAME_RULES.md) · [Parcours mobile](TOP1_PLAYER_JOURNEY.md)

## Ce que gagne une personne

| Résultat | Qui peut l’obtenir et comment |
| --- | --- |
| Nouveau record personnel | Une personne améliore son propre résultat dans le sens de l’épreuve, selon le **même protocole**. À palier de jeu égal, une amélioration brute reste visible. Pour les données physiologiques, afficher l’évolution numérique et ses unités. Publier un « meilleur taux » médical n’a pas de sens ici. |
| Palier « Défi TOP1 · Top 1 % » | Toute personne franchissant le seuil du jeu pour son épreuve et son profil de calcul. Le nombre de détenteurs est illimité. Une progression plus fine continue en répétitions, secondes ou kilogrammes. |
| « Top 5 % ou mieux de la cohorte » | Une personne dépasse strictement le P95 publié pour une poigne ou un saut compatibles. Pour le VO₂, la limite publiée est le Top 10 % ou mieux. Une égalité sur un seuil publié et arrondi conserve la bande prudente adjacente. |
| « 1ᵉʳ sur 640 participants TOP1 vérifiés » | Proposition de compétition entre inscrits, pour une saison, une division et un protocole identifiés. Une performance contrôlée par participant et règlement, meilleur essai admissible, égalités annoncées, nombre de participants affiché. La place reste valable même avec peu d’inscrits. |
| « Dans le Top 1 % de ces participants » | Proposition pour un classement exhaustif. Avec le rang occupé **le moins favorable dans le groupe d’ex æquo**, le pourcentage est `100 × rang / participants distincts`. Le groupe occupant les places 1 à 2 sur 100 atteint 2 %. Il faut au moins 100 personnes admissibles pour qu’une première place unique puisse atteindre 1 %. |
| « Dans le Top 0,00001 % de ces participants » | Même règle. Un seul premier sur **10 000 000** donne 0,00001 %. Deux premiers ex æquo sur dix millions donnent 0,00002 % selon cette convention. Ce calcul est un rang dans une liste complète et délimitée. Inférer une rareté dans la population demanderait en plus un échantillonnage pertinent, un nombre d’observations extrêmes suffisant et une incertitude estimée par cohorte et par protocole. |
| Top 1 % ou Top 0,00001 % mondial | **Aucune des 36 mesures ne permet actuellement de l’attribuer.** Aucun dénominateur mondial approprié ni aucune de ces deux limites empiriques n’est connecté. Être champion d’une compétition permet de documenter une place dans cette compétition. |

La position personnelle de l’écran Classement est le pourcentage d’anciennes **valeurs numériques** strictement inférieures, plus la moitié des égalités. Un temps de course plus court peut donc y donner un percentile numérique plus bas. Le libellé d’amélioration doit suivre séparément le sens du test. Les entrées rapides sans protocole restent classables dans le journal par valeur, avec une portée limitée à ce journal. Les ratios issus des sorties d’un simulateur et les probabilités de réussite d’un objectif sont encore d’autres quantités. [Rang personnel](../lib/rankExplorer.ts) · [Comparabilité des retests](../lib/history.ts) · [Règles des bornes publiées](../lib/topBands.ts)

## Comment lire les valeurs de l’audit

Profil reproductible **30 ans, sexe de référence masculin, 75 kg, 175 cm**. Les variantes « F » utilisent le même âge et le même poids avec le sexe de référence féminin. « Non renseigné » désigne le calcul de jeu disponible sans choix de sexe. Aucune cohorte publiée ne s’active avec ce dernier choix. Les frontières ci-dessous sont celles des **valeurs stockées**, à 0,001 près ou à la répétition entière. Elles décrivent le logiciel. Le nombre de chiffres n’indique ni la précision de l’instrument ni une cible d’entraînement. Une flèche indique le sens d’une performance ; « suivi » signifie qu’aucune direction universelle d’amélioration n’est proposée.

Dans les tables, **Ouvert** désigne l’une des 13 futures compétitions vérifiables ; la progression brute reste ouverte même après le dernier palier v10. **Plafonné** conserve un défi fonctionnel ou une borne publiée. **Suivi** conserve la mesure en option et la retire des incitations à battre d’autres personnes. « Aucun » indique une absence de palier pour toute valeur valide. Pour toutes les lignes sans source de cohorte explicitement nommée, aucune distribution de population n’est connectée. [Affectation des cohortes](../lib/metricStandings.ts) · [Barèmes de terrain](../lib/fieldBenchmarks.ts) · [Unités de saisie](../lib/focusedEntry.ts)

### Poids du corps · 8 mesures

| Mesure et unité enregistrée | Repère annoncé dans le code | Palier 1 % effectif v10 | Décision et protocole de progression |
| --- | --- | --- | --- |
| Pompes strictes `pushups` · répétitions ↑ | ≥40 | **44** ; 43 reste à 2,5 % | **Ouvert.** Compter les répétitions complètes, amplitude et verrouillage définis, tronc aligné. Séparer les variantes sur les genoux, inclinées, chronométrées et cadencées. |
| Assis-debout 30 s `sit_to_stand` · répétitions ↑ | ≥36 | **34** | **Plafonné.** Même hauteur de chaise, bras croisés, même règle de comptage des répétitions terminées. Le plus haut palier v10 commençait à 34 et l’écran Classement présente désormais la progression personnelle. La valeur brute continue d’être enregistrée. Les seuils de dépistage STEADI utilisent notamment une règle différente pour la dernière répétition. [Protocole CDC](https://www.cdc.gov/steadi/media/pdfs/STEADI-Assessment-30Sec-508.pdf) |
| Équilibre yeux fermés `single_leg_balance` · s ↑ | ≥45 s | **38,264 s** | **Plafonné.** Même jambe, surface, position et critère d’arrêt. Afficher une limite de durée avant un essai plafonné et indiquer « limite atteinte » pour départager correctement les mesures censurées. La validation logicielle accepte actuellement jusqu’à 180 s et l’écran Classement présente la progression personnelle. |
| Suspension `dead_hang` · s ↑ | 45 s = 50 %, 120 s = 5 %, 180 s = 1 % | **180 s** | **Ouvert.** Définir barre, prise, bras tendus, absence d’assistance, début et fin. Une tenue de 181 s établit une différence brute par rapport à 180 s. |
| Tractions strictes `pullups` · répétitions ↑ | Derniers points empruntés à une communauté autosélectionnée, 30 H / 19 F = palier 5 %. Le 1 % est extrapolé | **33 H / 21 F / 27 non renseigné** | **Ouvert.** Même prise, départ bras tendus, franchissement défini, sans assistance ni élan. La cohorte de stagiaires pompiers de Lockie fournit un autre contexte, avec recrutement et variantes propres. [Étude originale, tableaux 3–4](https://www.mdpi.com/2071-1050/14/11/6548) |
| Dips `dips` · répétitions ↑ | ≥25 | **27** | **Ouvert** dès publication de l’amplitude et du critère de validité sur barres parallèles. Distinguer assistance, banc et lest. Conserver le journal strict en attendant ce règlement. |
| Saut en longueur sans élan `broad_jump` · m ↑ | ≥2,70 m | **2,615 m** | **Ouvert.** Départ à deux pieds derrière la ligne, mesure jusqu’au point de réception le plus proche, surface et nombre d’essais fixés. |
| Détente verticale `cmj` · cm ↑ | ≥62 cm | **59,917 cm** | **Ouvert** dans une division technique unique. Comparaison publiée séparée **CHMS P95** pour Leonardo avec balancement des bras, meilleure de trois tentatives valides après familiarisation. Les applications et les sauts mains sur les hanches forment d’autres séries. [Tableau CHMS 4](https://www150.statcan.gc.ca/n1/pub/82-003-x/2019010/article/00002/tbl/tbl04-eng.htm) |

### Force en salle · 5 mesures

Les quatre mouvements lestés demandent la charge, 1 à 10 répétitions et le poids corporel **au test**. L’éditeur accepte kg ou lb et conserve les charges en kg dans les détails. Une répétition correspond à un maximum déclaré directement, plusieurs répétitions à une estimation Epley. La valeur canonique et celle du catalogue sont un ratio arrondi à trois décimales. En traction lestée la formule utilise la masse totale pour estimer la 1RM, puis retranche le poids corporel. Un programme peut aussi viser des kg si le contexte de charge le permet. Pour un futur concours, proposer une division kg ou ratio annoncée à l’avance et des singles réussis vérifiés. Une estimation personnelle et un changement de poids restent traçables séparément. Les quatre valeurs en kg données ci-dessous sont des exemples pour une personne de 75 kg. [Calculs et conversions](../lib/derivations.ts) · [Éditeur](../lib/focusedEntry.ts)

| Mesure canonique | Repère annoncé | Palier 1 % effectif v10 | Décision et protocole de progression |
| --- | --- | --- | --- |
| Développé couché `bench_1rm` · × poids corporel ↑ | ≥1,65 | **1,498 H / 0,954 F** ; 112,5 kg en single donnent 1,500 | **Ouvert.** Distinguer pause et touch-and-go, matériel, amplitude, validation et catégorie de poids. |
| Squat `squat_1rm` · × poids corporel ↑ | ≥2,25 | **2,147 H / 1,575 F** ; 162,5 kg donnent 2,167 | **Ouvert.** Profondeur, équipement, barre et commandements définis. |
| Soulevé de terre `deadlift_1rm` · × poids corporel ↑ | ≥2,55 | **2,514 H / 1,922 F** ; 190 kg donnent 2,533 | **Ouvert.** Fixer verrouillage et équipement, politique de sangles et de position. |
| Poigne maximale simple `grip_strength` · kg ↑ | ≥68,5 kg | **65,448 H / 43,098 F** | **Ouvert** pour un protocole matériel précis. Comparaison publiée séparée **iGRIPS P95** pour la meilleure mesure individuelle avec les deux mains testées, trois essais par main, hydraulique en position assise. Les sommes de deux mains portent un autre identifiant. [iGRIPS](https://eprints.gla.ac.uk/339600/) |
| Traction lestée `pullup_1rm` · × poids corporel **ajouté** ↑ | ≥1,05 | **0,782** ; 60 kg ajoutés en single donnent 0,800 | **Ouvert.** Même prise et amplitude, bras tendus au départ, sans élan. À 75 kg de poids corporel un ajout de 60 kg déplace 135 kg au total. |

Une future référence « pratiquants en compétition » pour les trois mouvements de force peut partir des résultats OpenPowerlifting datés et figés. Filtrer les singles valides par fédération, équipement, discipline, sexe/division et pesée, dédupliquer les personnes et afficher le nombre effectivement admissible. Le nombre total de lignes de la base inclut des compétitions répétées. Réexaminer les sources et les conditions de réutilisation avant une extraction. [Données OpenPowerlifting](https://openpowerlifting.gitlab.io/opl-csv/bulk-csv.html) · [Description des colonnes](https://openpowerlifting.gitlab.io/opl-csv/columns.html)

### Course et cardio · 4 mesures

| Mesure et unité | Repère annoncé | Palier 1 % effectif v10 | Décision et protocole de progression |
| --- | --- | --- | --- |
| 5 kilomètres `run_5k` · minutes décimales stockées, min:s à l’écran ↓ | 20:00 = 1 %, 21:00 = 2,5 %, 22:30 = 5 %, 25:00 = 10 % | **≤20:00** dans le domaine valide, minimum 12:00 | **Ouvert.** Parcours mesuré, temps écoulé total ; séparer piste, route certifiée et tapis. Un chrono de déplacement GPS avec arrêts retirés reste une autre série. |
| 400 mètres `sprint_400m` · s ↓ | 50 s = 1 %, 54 s = 2,5 %, 57 s = 5 %, 60 s = 7,5 % | **≤50 s** dans le domaine valide, minimum 40 s | **Ouvert.** Piste mesurée, départ et chronométrage définis. Distinguer chrono manuel et automatique. |
| VO₂ de pointe `vo2_max` · mL/kg/min ↑ | ≥66,5 | **67,451 H / 50,438 F** à 30 ans dans le moteur historique, masqué comme défi par l’adaptateur Classement | **Plafonné à FRIEND P90** en comparaison publiée. Test d’effort direct sur tapis et critères détaillés ci-dessous. Estimation Cooper, montre et vélo conservent chacun leur série personnelle. |
| Puissance Zone 2 `zone2_power` · W/kg | ≥3,3 | **Aucun**, malgré la catégorie « challenge » de l’ancien inventaire | **Suivi.** Même définition du seuil, méthode d’identification, ergomètre calibré, watts, pesée et durée stabilisée. Une compétition de puissance à durée fixe demanderait une autre définition. |

### Mesures corporelles · 3 mesures

| Mesure et unité | Repère historique ou stocké | Palier 1 % effectif v10 | Décision et suivi personnel |
| --- | --- | --- | --- |
| Rapport taille abdominale / stature `waist_height_ratio` · ratio | Contexte individuel ; plateau de jeu à 0,4–0,5 | **0,363–0,537 inclus**, masqué dans Classement | **Suivi.** Même repère anatomique et mêmes unités pour les deux longueurs. Retirer le plateau des récompenses. |
| Masse grasse `body_fat` · % | Champ de cible contextualisé. Le barème de terrain accorde 1 % à 17 % ou moins quel que soit le sexe | **3–17 % inclus**, masqué dans Classement | **Suivi.** Retirer l’incitation à diminuer la masse grasse. Conserver le type de mesure, par exemple DXA, BIA ou plis cutanés. Une future distribution descriptive DXA nécessiterait sa propre validation. [Étude NHANES DXA](https://doi.org/10.1371/journal.pone.0007038) |
| Pression artérielle systolique `bp_systolic` · mmHg | Ancienne chaîne « <106 » | **Aucun** | **Suivi.** Brassard, posture, repos et méthode de mesure à conserver. Retirer la chaîne de cible de toute surface de jeu. |

### Récupération · 7 mesures

| Mesure et unité | Repère historique ou stocké | Palier 1 % effectif v10 | Décision et suivi personnel |
| --- | --- | --- | --- |
| Sommeil total `total_sleep` · minutes stockées, heures/nuit à la saisie | ≥420 min ; plateau plein à 420–540 min | **391,568–568,432 min inclus** avant conversion d’affichage. Valeurs entières 392–568 min. Masqué dans Classement | **Suivi.** Suivre les nuits ou moyennes de même fenêtre, selon la même source. Retirer les récompenses appuyées sur une durée. |
| Fréquence cardiaque au repos `rhr` · battements/min | Contexte personnel ; plateau plein à 50–65 | **44,314–70,686 inclus** ; valeurs entières 45–70. Masqué dans Classement | **Suivi.** Même moment et position au repos, même appareil. Pas de course au minimum. |
| Variabilité cardiaque RMSSD `hrv` · ms | ≥110 | **≥103,159 ms** dans le moteur historique, masqué dans Classement | **Suivi.** Consigner appareil, position, durée et méthode RMSSD. SDNN et scores propriétaires restent distincts. |
| Récupération cardiaque à une minute `hrr_1min` · baisse en battements/min | ≥45 | **Aucun** | **Suivi.** Consigner l’effort initial, l’instant d’arrêt, le délai de 60 s et la récupération active ou passive. |
| Efficacité du sommeil `sleep_efficiency` · % | ≥96 | **Aucun** | **Suivi.** Même dénominateur, durée de sommeil / temps au lit, même instrument et même fenêtre. |
| Régularité circadienne `circadian_regularity` · score /100 | ≥92 | **Aucun** | **Suivi.** Identifier l’algorithme et la fenêtre. Un score propriétaire sur 100 ne se convertit pas automatiquement en Sleep Regularity Index. |
| Temps de réaction `reaction_time` · ms | ≤175 | **Aucun** | **Suivi.** Séparer réaction simple et choix, appareil et entrée, entraînement initial, nombre d’essais et statistique retenue. Une latence matérielle différente peut produire un nouveau « record ». [Validation d’une tâche standardisée](https://doi.org/10.3758/s13428-010-0024-1) |

### Analyses sanguines · 9 mesures

Les neuf champs actifs portent la cible générique « résultat de laboratoire, interprétation clinique ». Le jeu v10 les exclut avant tout calcul, y compris lorsque d’anciennes constantes de plateau subsistent dans la fonction. Les anciens chiffres cités dans des scripts de présentation n’attribuent aucun palier. La direction du suivi reste descriptive. [Registre et exclusions](../lib/registry.ts) · [Contexte scientifique par analyse](METRIC_RESEARCH_GAPS.md)

| Mesure active | Unité conservée et affichée | Palier 1 % effectif | Décision et détail à conserver |
| --- | --- | --- | --- |
| Glycémie à jeun `fasting_glucose` | mg/dL | Aucun | **Suivi.** Documenter plasma et jeûne. Une valeur rapportée en mmol/L nécessite la conversion appropriée avant la saisie. |
| Hémoglobine glyquée `hba1c` | % | Aucun | **Suivi.** Distinguer % NGSP et mmol/mol IFCC. |
| Apolipoprotéine B `apob` | mg/dL | Aucun | **Suivi.** Conserver l’unité et le laboratoire pour les comparaisons de série. |
| Lipoprotéine(a) `lpa` | nmol/L | Aucun | **Suivi.** Conserver l’unité molaire et la méthode ; les valeurs massiques en mg/dL demandent une interprétation spécifique. |
| Protéine C-réactive ultrasensible `hscrp` | mg/L | Aucun | **Suivi.** Identifier le dosage ultrasensible et garder son contexte de prélèvement. |
| Insuline à jeun `fasting_insulin` | µIU/mL | Aucun | **Suivi.** Conserver méthode et jeûne. L’insuline isolée et un indice calculé à partir de plusieurs dosages ont des identités distinctes. |
| Gamma-glutamyltransférase `ggt` | U/L | Aucun | **Suivi.** Conserver méthode et plage rapportée par le laboratoire. |
| Cystatine C `cystatin_c` | mg/L | Aucun | **Suivi.** Distinguer la concentration de l’estimation du débit de filtration calculée avec une équation. |
| Homocystéine `homocysteine` | µmol/L | Aucun | **Suivi.** Conserver les conditions de prélèvement. Aucun objectif d’entraînement dérivé de cette concentration. |

## Comparaisons publiées et exemples du barème historique v10

| Source et participants | Règles exécutées | Exemple indépendant du palier de jeu |
| --- | --- | --- |
| **iGRIPS**, 2 405 863 adultes, 100 études, 69 pays ou territoires, référence harmonisée et pondérée. Sexes de référence et tranches de cinq ans à partir de 20 ans, dernière tranche 100+ | Test daté, âge au test cohérent, protocole hydraulique assis sur les deux mains et trois essais, meilleur résultat individuel en kg. Table 2, P5 à P95. | Homme 30–34 ans, P90 = 61,5 kg, P95 = 64,9 kg. **65 kg** donne « Top 5 % ou mieux » dans la référence et **palier 2,5 %** dans le barème historique v10. L’égalité à 64,9 conserve la limite plus large de 10 %. [Publication iGRIPS](https://eprints.gla.ac.uk/339600/) · [Seuils chargés](../lib/gripReference.ts) |
| **CHMS**, enquête canadienne pondérée de 2016–2017. 5 188 participants à l’analyse portant sur plusieurs tests et âges. L’échantillon effectif varie avec le test, l’âge et le sexe | Saut mesuré avec bras par Leonardo ; meilleur de trois sauts valides après familiarisation, jusqu’à cinq tentatives pour obtenir trois essais valides. Âge au test 18–69 dans l’extraction active. P10/P50/P90/P95 par groupe d’âge et sexe. | Homme 30–34 ans, P90 = 56,3 cm et P95 = 59,1 cm. **59,2 cm** est dans « Top 5 % ou mieux ». Le palier historique v10 de 1 % commence à **59,917 cm**. Données adaptées de Statistique Canada, sans approbation du produit par Statistique Canada. [Étude](https://www150.statcan.gc.ca/n1/pub/82-003-x/2019010/article/00002-eng.htm) · [Tableau 4](https://www150.statcan.gc.ca/n1/pub/82-003-x/2019010/article/00002/tbl/tbl04-eng.htm) · [Licence](https://www.statcan.gc.ca/en/terms-conditions/open-licence) |
| **FRIEND 2022**, 16 278 tests sur tapis parmi les 22 379 tests sur tapis et vélo de l’étude américaine, adultes de 20–89 ans | CPET direct sur tapis, date, âge au test, sexe de référence, pic de RER ≥1,0 et compatibilité déclarée avec les critères de la référence, sans maladie cardiovasculaire ou BPCO connue. Neuf déciles chargés, P10 à P90. | Hommes 30–39 ans, n = 1 473 tests, P90 = 55,5 mL/kg/min. **55,6** donne « Top 10 % ou mieux » ; la valeur égale au seuil reste dans la borne de 20 %. Chez les femmes 30–39 ans, n = 1 043 et P90 = 42,1. [Publication FRIEND](https://pubmed.ncbi.nlm.nih.gov/34809986/) · [Extraction](../lib/friend2022.ts) · [Compatibilité](../lib/scientificCalibration.ts) |

Un profil sans sexe de référence peut toujours suivre les défis. Pour les treize tests étudiés sous v10, les règles de jeu ne variaient pas avec l’âge adulte. Elles varient avec le sexe de référence pour les tractions strictes, la poigne et les trois mouvements de force sur barre. À 30 ans sans sexe renseigné, les seuils v10 sont 27 tractions, 65,264 kg à la poigne, 1,498 au développé couché, 2,147 au squat et 2,514 au soulevé de terre. Les trois épreuves de force tombent ici sur les mêmes nombres que le profil masculin, par le choix des constantes de repli. Cette option est un barème produit. Dans le moteur historique du VO₂, le seuil sans sexe renseigné est 58,938 mL/kg/min pour le même âge. Le comparateur publié exige toujours le sexe de référence et l’âge au moment du test. [Politique des défis](../lib/challengeProgress.ts) · [Valeurs démographiques](../lib/demographics.ts)

Un seuil extrême d’une table reste ouvert pour toutes les valeurs au-delà, quelle que soit leur distance au seuil. Les effectifs totaux de ces études ne fournissent pas le nombre de sportifs de même âge, sexe et protocole dans une queue à un sur dix millions. Une courbe en cloche peut illustrer les bandes du jeu. Un histogramme, une fonction de répartition empirique ou des bandes publiées décrivent mieux une population observée selon les données réellement disponibles. [Règles de calibration](../lib/benchmarkCalibration.ts)

## Reproduction du barème historique v10

**Pompes, ancien barème v10.** Lors de trois tests stricts distincts, 20 → 22 → 25 répétitions donnent respectivement **55 % → 45 % → 35 %** sur le barème de jeu de ce profil. Entre 20 et 21 le palier reste 55 %. Le prochain palier commence à 22, puis le palier 35 % commence à 24. À 40 répétitions on lit 2,5 %, à 44 on lit 1 %, et à 60 on lit encore 1 %. Passer de 44 à 60 vaut **16 répétitions de progression** même lorsque le palier reste identique. Ces trois premiers tests pourraient être les seuls essais d’un débutant. Ils suffisent pour démontrer sa progression si leur protocole correspond.

**5 km.** 25:00 → 22:00 → 20:00 donne **10 % → 5 % → 1 %**. 21:00 vaut 2,5 % et 22:30 vaut 5 %. Deux personnes à 20:00 et 18:30 partagent le dernier palier, avec 90 s d’écart observé. En course, un record s’améliore quand le temps baisse.

**Profil global.** Historiquement `benchmarkGame({pushups:44}, profil)` et `benchmarkGame({total_sleep:450}, profil)` retournent chacun un total de 1 % avec une seule valeur. Le moteur moyenne les piliers renseignés, ce qui rend le nombre et le choix des épreuves déterminants. Le pilote séparé `balanced-challenge-v1` impose une épreuve valide dans chacune des quatre familles poussée, tirage, bas du corps et endurance. Il affiche le **plus faible** des quatre paliers. Pour y obtenir un 1 % de jeu, les quatre résultats qualifiants doivent atteindre leur palier 1 %. La batterie de recherche n’a pas de calibration de population connectée. Ces trois mécanismes demandent trois libellés distincts. [Agrégat historique](../lib/benchmarkGame.ts) · [Profil équilibré](../lib/balancedBaseline.ts) · [Batterie de recherche](../lib/benchmark.ts)

**Limites de saisie.** Les extrémités valides du registre plafonnent déjà les résultats bruts. Pour les 13 épreuves : 150 pompes, 100 tractions et 100 dips, 1 200 s de suspension, 4 m de saut en longueur, 120 cm de détente, 120 kg de poigne, 3 × poids corporel au développé couché, 4 × au squat, 5 × au soulevé de terre, 2 × de charge ajoutée pour la traction lestée, un minimum de 12:00 sur 5 km et de 40 s sur 400 m. Ainsi, **151 pompes sont rejetées à la saisie**, même avec une preuve. Ces valeurs de validation ont pour fonction de repérer les erreurs d’unité. Pour une compétition ouverte, prévoir une voie de validation humaine des résultats hors intervalle et assurer le stockage de la valeur vérifiée avant de promettre une progression illimitée. [Bornes du registre](../lib/registry.ts) · [Validation](../lib/engine.ts)

Le contrôle suivant s’exécute depuis la racine avec les dépendances installées. Il affiche la totalité des 36 lignes et les dix archives, puis les paliers des exemples de pompes. La recherche travaille sur la grille des valeurs enregistrables ; pour le barème v10 chaque zone 1 % est un intervalle contigu avec une zone intérieure large ou un point extrême sur la grille sondée. Les deux bissections repèrent les bornes inclusives. Le code valide aussi les points immédiatement voisins.

```sh
node --require tsx/cjs - <<'JS'
const {metrics} = require('./lib/registry.ts');
const {valid} = require('./lib/engine.ts');
const {metricGameEstimateV10: metricGameEstimate} = require('./lib/benchmarkGame.ts');
const profile = {age: 30, sex: 'male', weight: 75, height: 175};
function bounds(metric, person) {
  const scale = valid(metric, metric.min + 0.001) ? 1000 : 1;
  const lo = Math.ceil(metric.min * scale), hi = Math.floor(metric.max * scale);
  const wins = i => metricGameEstimate(metric.id, i / scale, person)?.top === '1%';
  const samples = Array.from({length: 101}, (_, i) => Math.round(lo + (hi - lo) * i / 100));
  const seed = samples.find(wins);
  if (seed === undefined) return '—';
  let a = lo, b = seed;
  while (a < b) {
    const mid = Math.floor((a + b) / 2);
    if (wins(mid)) b = mid; else a = mid + 1;
  }
  const first = a;
  a = seed; b = hi;
  while (a < b) {
    const mid = Math.ceil((a + b) / 2);
    if (wins(mid)) a = mid; else b = mid - 1;
  }
  if (!wins(first) || !wins(a) || (first > lo && wins(first - 1)) || (a < hi && wins(a + 1))) {
    throw new Error(metric.id);
  }
  return [first / scale, a / scale];
}
for (const m of metrics) console.log(m.archived ? 'archive' : 'actif', m.id, bounds(m, profile));
for (const n of [20,21,22,24,25,40,43,44,60]) console.log(n, metricGameEstimate('pushups',n,profile)?.top);
JS
```

La prise en compte de la grille de l’interface est également nécessaire pour suggérer une prochaine saisie atteignable. Par exemple, 2,615 m est la frontière stockée du saut horizontal. Un test enregistré au centimètre entier passera à 2,62 m. L’arrondi ou l’unité pratique ne modifie pas la précision du modèle. [Validation](../lib/engine.ts) · [Saisie actuelle](../lib/focusedEntry.ts)

## Dix identités archivées

Chacun de ces identifiants garde sa définition de stockage et ses anciennes observations. Aucun ne figure dans les 36 cartes de saisie, dans les 13 défis individuels ni dans le score v10 pour les actifs. Restaurer un ancien test demanderait une décision explicite et la vérification de son protocole ; aucune observation ancienne ne doit changer de discipline. [Test de conservation des archives](../lib/metricInventory.test.ts)

| Identifiant conservé | Unité et identité | Décision |
| --- | --- | --- |
| `pefr` | % du débit expiratoire de pointe prédit | **Archive.** L’équation de référence, son domaine et la technique de spirométrie sont indispensables à l’interprétation. |
| `visceral_fat` | cm² de graisse viscérale | **Archive.** Préserver la méthode d’imagerie. Ne pas convertir en masse grasse totale ou en tour de taille. |
| `farmers_carry` | s de portage, charge totale prévue de 1 × poids corporel | **Archive.** Candidat conditionnel au retour avec couloir, virages, charge par main, prise et arrêt définis. Un portage chronométré sur distance fixe serait un protocole différent. |
| `ankle_dorsiflexion` | degrés de flexion de cheville | **Archive.** Comparer côté, position et instrument. La distance genou-contre-mur en cm est une autre grandeur. |
| `run_10k` | minutes pour 10 km | **Archive, candidat à la réactivation.** Distinct du 5 km actif. Les anciens résultats de finishers et leur barème dédié ne s’appliquent pas au 5 km ou à tous les adultes. |
| `grip_combined` | kg, somme du meilleur résultat de chaque main | **Archive, protocole alternatif éventuel.** CHMS conserve sa table P95 ; adultes 18–79, debout avec Smedley III et deux essais alternés par main. Les trois essais NHANES et le meilleur résultat hydraulique individuel ont d’autres règles. [Tableau CHMS 1](https://www150.statcan.gc.ca/n1/pub/82-003-x/2019010/article/00002/tbl/tbl01-eng.htm) |
| `sprint_10m` | s sur 10 mètres | **Archive, candidat à la réactivation.** Départ et cellules électroniques déterminent la comparabilité. Ne pas utiliser un ancien 10 m comme fraction mesurée du 100 m ou du 400 m. |
| `sauna_minutes` | min/semaine d’exposition au sauna | **Archive.** Une durée d’exposition ne mesure aucune victoire sportive. |
| `cold_plunge_minutes` | min/semaine d’immersion froide | **Archive.** Aucun défi de durée ou de température proposé. |
| `thermal_hrv_rebound` | ratio RMSSD après / avant exposition | **Archive.** Préserver les conditions et les deux mesures distinctes d’une RMSSD habituelle en ms. |

## Tests à évaluer ensuite

Priorités proposées selon la possibilité de comparer réellement les résultats et la valeur ajoutée aux 46 identités. La mention « ouvert » signifie qu’un résultat brut ordonne des participants d’une épreuve correctement mesurée. Aucun de ces candidats n’apporte aujourd’hui un palier mondial ou une nouvelle table active.

| Priorité et statut | Épreuve et intérêt | Protocole, sens et plafond proposés |
| --- | --- | --- |
| **P1 · nouveau** `rowerg_2000m` | 2 000 m sur rameur ; endurance assise sur distance fixe et preuve issue du moniteur. Aucune mesure d’aviron existante | Rameur statique Concept2 avec distance-programme 2 000 m, temps écoulé en secondes ↓, modèle, type de machine et preuve du moniteur ou d’épreuve. Séparer dynamique et slides. **Ouvert** aux participants de même division, pas de percentile général importé. Un temps inscrit et un record officiel Concept2 obéissent à des critères de preuve distincts. [Règlement du classement](https://log.concept2.com/rankings) · [Aide Concept2](https://log.concept2.com/help/) |
| **P1 · réactivation** `run_10k` | Le chrono officiel d’un 10 km fournit une preuve identifiable. Réutiliser l’identité existante | Course mesurée sur 10 km, surface, parcours, dénivelé, système de temps et temps écoulé ↓. **Ouvert** pour un règlement fixé. Conserver les anciennes mesures dans leur protocole d’origine ; une nouvelle preuve doit être attachée avant une participation vérifiée. |
| **P2 · nouveau** `sprint_100m` | Vitesse sur 100 m ; complète le 400 m et mesure autre chose que l’accélération sur 10 m déjà archivée | 100 m en ligne droite, départ réglementé, chronométrage entièrement automatique, vent homologué ≤ +2,0 m/s, temps en s ↓. **Ouvert** aux résultats officiels compatibles ; séparer chrono manuel, salle et vent inconnu. [World Athletics, discipline](https://worldathletics.org/disciplines/sprint/100-metres) · [Règles techniques](https://worldathletics.org/about-iaaf/documents/technical-information) |
| **P2 · nouveau** `sit_and_reach_chms` | Portée assise standardisée, complément de mobilité ; différente de la dorsiflexion articulaire en degrés | Fixer le protocole et le zéro du flexomètre, position, essais et résultat retenu exactement comme dans CHMS. Cm, direction numérique ↑ pour la comparaison descriptive. **Plafonné** au plus haut quantile validé de la cellule d’âge/sexe, avec objectif libre ; aucune compétition de souplesse extrême. Revoir la table, la licence et les correspondances avant branchement. [Étude CHMS](https://www150.statcan.gc.ca/n1/pub/82-003-x/2019010/article/00002-eng.htm) · [Tableau 3](https://www150.statcan.gc.ca/n1/pub/82-003-x/2019010/article/00002/tbl/tbl03-eng.htm) |
| **P3 · réactivation** `sprint_10m` | Accélération, équipement plus difficile à homogénéiser | Même position et distance de départ par rapport à la première cellule, hauteur des portes et surface ; s ↓. **Ouvert** seulement au circuit instrumenté correspondant. Le barème logiciel archivé et les chronos manuels ne donnent aucun percentile. |
| **P3 · réactivation** `grip_combined` | Alternative CHMS au test de poigne actif si l’équipement existe | Réutiliser le protocole Smedley III de l’archive et les kg additionnés, ↑. **Plafonné** au P95 chargé, avec accès au suivi personnel au-delà. Compter une seule épreuve de poigne dans un éventuel profil multisport. |

## Compatibilité des observations

Les 36 mesures actives et les dix identifiants archivés conservent leurs unités et leurs historiques. Les anciennes évaluations se relisent avec leur version de calcul. Le profil équilibré historique conserve notamment l’assis-debout pour sa couverture du bas du corps. [Test d’inventaire](../lib/metricInventory.test.ts) · [Profil équilibré historique](../lib/balancedBaseline.ts)

Le champ `target` du registre, une ancre de jeu, un seuil publié et la frontière affichée désignent des données distinctes. Garder la version du barème et la cohorte avec un calcul reproduit. Une mise à jour conserve la valeur, l’unité, le protocole et le contexte daté des anciennes observations. [Registre](../lib/registry.ts) · [Calcul historique](../lib/benchmarkGame.ts) · [Historique](../lib/history.ts)
