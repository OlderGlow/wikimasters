// Classifieur par règles pour les cartes WikiMasters.
// Entrée : {t: titre Wikipédia, d: description courte (champ `category`)}.
// Sortie : {tags: [...1 à 3], score} ; aucune règle → ['à classer'].
// S'exécute tel quel dans la page wiki-masters.com (aucune requête réseau).

// Un mot suivi de « ! » doit être un mot entier (sinon préfixe : « chanteu » couvre chanteur/chanteuse).
const W = s => new RegExp('(?<![\\p{L}-])(?:' + s.replace(/!/g, '(?![\\p{L}-])') + ')', 'iu');

const PERSON = W("acteur|actrice|comédien|chanteu|musicien|compositeur|compositrice|auteur-compositeur|rappeu|pianiste|guitariste|violoniste|batteu|chef d'orchestre|dj!|écrivain|romancier|romancière|poète|poétesse|dramaturge|auteur|autrice|scénariste|réalisateur|réalisatrice|metteu|producteur|productrice|peintre|sculpteu|photographe|illustrateur|illustratrice|dessinateur|dessinatrice|homme politique|femme politique|homme d'affaires|femme d'affaires|homme d'état|femme d'état|diplomate|footballeu|joueu|athlète|cycliste|nageu|skieu|boxeu|tennisman|judoka|basketteu|handballeu|rugbyman|catcheu|gymnaste|patineu|escrimeu|entraîneu|pilote!|philosophe|physicien|chimiste|mathématicien|biologiste|astronome|médecin!|médecins!|chirurgien|ingénieur|inventeu|architecte|journaliste|animateur|animatrice|présentateur|présentatrice|humoriste|mannequin|styliste|couturi|entrepreneu|astronaute|cosmonaute|aviateur|aviatrice|explorateur|exploratrice|navigateur|navigatrice|général de|général d'|général français|général américain|général allemand|général britannique|général romain|maréchal|amiral|officier|soldat|roi!|reine|empereur|impératrice|prince|princesse|pape|évêque|cardinal|prêtre|moine|youtubeu|vidéaste|streameu|influenceu|danseu|chorégraphe|historien|économiste|linguiste|tueu|personnalité|noble!|duc!|duchesse|comte|comtesse|pharaon|militant|activiste|chef cuisinier|cuisinier|cinéaste|magistrat|juge!|avocat|policier|clown|culturiste|pâtissier|patissier|politicien|sociologue|costumi|psychologue|psychiatre|imprimeu|libraire|baron!|baronne|marquis!|marquise|vicomte|chevalier|disc-jockey|disc jockey|karatéka|taekwondoïste|rameu|céiste|kayakiste|hockeyeu|grimpeu|alpiniste|surfeu|plongeu|bobeu|archère|archer!|sprinteu|cavalier|cavalière|soprano|mezzo-soprano|ténor|baryton|saxophoniste|trompettiste|flûtiste|harpiste|claveciniste|organiste|violoncelliste|hautboïste|bassiste|bluesman|ornithologue|entomologiste|zoologiste|naturaliste|anthropologue|égyptologue|orientaliste|géographe|neurologue|dermatologue|ophtalmologue|pharmacien|samouraï|seigneur!|aristocrate|archiduc|archiduchesse|patriarche|abbé!|abbesse|syndicaliste|féministe|mangaka|traducteur|traductrice|enseignant|éducateur|éducatrice|universitaire|programmeu|sommelier|restaurateur|oligarque|industriel|espion|espionne|condottiere|doge!|martyr|psychanalyste|épidémiologiste|épidémiologue|monteuse|monteur de cinéma|chef monteu|coureu|supérieur religieux|jésuite|collectionneu|bourreau|exécuteur public|pionnier|pionnière|carcinologiste|malacologiste|herpétologiste|ichtyologiste|arachnologue|néo-nazi|climatologue|météorologue|glaciologue|volcanologue|géologue|océanographe|monteur sonore|ingénieur du son|concepteur sonore|dominicain français|frère dominicain|franciscain|bénédictin|khan de|khan des|lutteu|négociant|colon!|femme d'affaire|homme d'affaire|accordéoniste|percussionniste|contrebassiste|clarinettiste|tromboniste|altiste|luthiste|envoyé|ambassadeu|dalaï-lama|chef spirituel|évèque|militaire (?:\\p{L}+(?:ais|ain|ien|ois|que|and|ol|on|in|en|ite))!|général (?:\\p{L}+(?:ais|ain|ien|ois|que|and|ol|on|in|en|ite))!|criminel (?:\\p{L}+(?:ais|ain|ien|ois|que|and|ol|on|in|en|ite))!|gendarme!|matador|chercheu|pratiquant|triathlète|biathlète|pongiste|volleyeu|fondeu|sauteu|curleu|skipper|prélat|sportif!|botaniste|informaticien|pianofortiste|artiste!|aventurier|aventurière|designer!|designers!|sculptrice|astrophysicien|snowboardeu|snowboarder|skeletoneu|vététiste|haltérophile|funambule|kick-boxeu|graphologue|écologue|probabiliste|romaniste|librettiste|médiéviste|anthropologiste|caméraman|littérateur|érudit!|infirmier|infirmière|promoteur immobilier|banquier|banquière|haut fonctionnaire|haute fonctionnaire|éditrice|pédagogue|grammairien|gladiateur|combattant (?:\\p{L}+(?:ais|ain|ien|ois|que|and|ol|on|in|en|ite|e))!|héroïne de|héros de l'union|mère de famille|représentant!|représentante!|pair de france|maharaja|sultan!|margrave|landgrave|intendant|colonisateur|artiste lyrique|chanteuse lyrique|chanteur lyrique|mycologue|catholicos");

// Ordre = priorité en cas d'égalité de score.
const RULES = [
  ['musique', "synthétiseur|musique|musical|musicien|chanteu|chanson|single|album|groupe de musique|groupe de rock|groupe de rap|groupe de jazz|groupe de métal|groupe de pop|rappeu|rap!|raps!|hip-hop|rock|jazz|métal!|métals!|pop!|pops!|opéra!|opéras!|orchestre|compositeur|compositrice|auteur-compositeur|pianiste|guitariste|violoniste|batteu|chef d'orchestre|dj!|djs!|instrument de musique|genre musical|label|disque|tournée|festival de musique|hymne|symphonie|concerto"],
  ['film', "cinéaste|film|cinéma|réalisat|acteur|actrice|comédien|court métrage|long métrage|scénariste|metteu|studio de cinéma|personnage de film|franchise"],
  ['série-tv', "mini-série|série télévisée|série d'animation|émission|télévision|télévisé|téléfilm|feuilleton|chaîne de télévision|anime|dessin animé|animat(?:eur|rice) de|présentat|sitcom|téléréalité|telenovela|télénovela|saison d'une série"],
  ['littérature', "littérature|littéraire|bande-dessinée|écrivain|romancier|romancière|poète|poétesse|roman!|romans!|livre|bande dessinée|manga!|mangas!|œuvre littéraire|nouvelle!|nouvelles!|essai|auteur de|autrice de|dramaturge|pièce de théâtre|poème|recueil|conte!|contes!|personnage de fiction|personnage de roman|saga|comics|maison d'édition|éditeur|journal!|journaux!|magazine|périodique"],
  ['art', "clown|peintre|peinture|sculpteu|sculpture|tableau|œuvre d'art|musée|artiste|photographe|illustrat|dessinat|mouvement artistique|graveu|plasticien|galerie|fresque|danse|danseu|chorégraphe|ballet|théâtre|cirque|art!|arts!"],
  ['architecture', "édifice|bâtiment|cathédrale|château|monument|pont!|ponts!|tour!|tours!|gratte-ciel|basilique|abbaye|palais|architecte|architecture|stade|phare|fort!|forts!|forteresse|citadelle|immeuble|place!|places!|rue!|rues!|avenue|boulevard|jardin|fontaine|arc de|statue!|statues!|hôtel"],
  ['guerre', "guerre|bataille|siège de|conflit|invasion|offensive|opération militaire|massacre|génocide|résistance|insurrection|rébellion|révolte|bombardement|front!|fronts!"],
  ['militaire', "militaire|général|maréchal|officier|soldat|armée|régiment|division|unité|arme!|armes!|fusil|pistolet|char!|chars!|navire de guerre|cuirassé|porte-avions|sous-marin|avion de chasse|avion militaire|bombardier|missile|amiral|marine nationale|force aérienne|grade"],
  ['histoire', "ethnie|peuple|passé!|passés!|histoire|historique|historien|empire|royaume|dynastie|siècle|antiquité|antique|médiéval|moyen âge|époque|période|civilisation|archéolog|préhistoire|roi!|rois!|reine|empereur|impératrice|pharaon|monarque|souverain|révolution|traité|colonie|noble!|nobles!|duc!|ducs!|duchesse|comte|comtesse"],
  ['politique', "politicien|droit!|droits!|lgbt|association|organisation non gouvernementale|mouvement social|homme politique|femme politique|homme d'état|femme d'état|parti politique|politique|président|premier ministre|ministre|député|sénateur|maire|élection|diplomate|chef d'état|chef de gouvernement|gouvernement|syndicat|idéologie|militant|activiste|organisation internationale|référendum|loi!|lois!|constitution"],
  ['religion', "religion|religieu|église|cathédrale|basilique|chapelle|pape!|papes!|évêque|cardinal|prêtre|moine|abbaye|monastère|mosquée|temple|synagogue|bible|biblique|chrétien|christianisme|catholique|protestant|orthodoxe|islam|musulman|bouddh|hindou|juda|juif|théolog|prophète|culte|secte!|sectes!"],
  ['mythologie', "mythologie|mythologique|divinité|dieu|déesse|créature|légende|légendaire|mythe|héros de|nymphe|titan!|titans!|démon|folklore"],
  ['philosophie', "philosophe|philosophie|philosophique|courant de pensée|concept philosophique"],
  ['science', "sociologue|sociologie|science|scientifique|physicien|physique|chimiste|chimie|chimique|mathématicien|mathématique|biologiste|biologie|géologie|géolog|minéral|roche!|roches!|théorème|équation|élément chimique|composé chimique|composé organique|particule|unité de mesure|astronome|phénomène|loi de|théorie|molécule|protéine|gène|cellule"],
  ['médecine', "maladie|médecin|médecine|médical|médicament|syndrome|trouble|virus|bactérie|anatomie|organe|muscle|infection|hôpital|chirurg|psychiatr|psycholog|vaccin|cancer|tumeur|symptôme|pathologie|traitement|santé|drogue|hormone"],
  ['technologie', "technologie|technique|invention|inventeu|appareil|machine|électronique|ingénieu|moteur|robot|outil|dispositif|matériel|téléphone|smartphone|énergie|nucléaire|centrale"],
  ['informatique', "logiciel|langage de programmation|système d'exploitation|informatique|ordinateur|site web|site internet|application|réseau social|algorithme|internet|protocole|format de fichier|navigateur web|moteur de recherche|intelligence artificielle|cryptomonnaie|youtubeu|vidéaste|streameu|influenceu"],
  ['jeu-vidéo', "vidéoludique|jeu vidéo|jeux vidéo|console|personnage de jeu|développeur de jeux|éditeur de jeux|jeu de rôle|jeu de société|jeu de cartes|jeu!|jeus!"],
  ['sport', "ligue|culturiste|culturisme|musculation|sport|sportif|sportive|footballeu|football|joueu|club!|clubs!|athlète|athlétisme|cycliste|cyclisme|tennis|rugby|basket|handball|nageu|natation|skieu|ski|boxeu|boxe|compétition|championnat|coupe!|coupes!|tournoi|jeux olympiques|olympique|équipe|entraîneu|course|marathon|golf!|golfs!|judo|lutte|catch|escrim|patin|gymnast|volley|stade|arts martiaux|pilote de course|formule 1|rallye|grand prix|tour de france|échecs"],
  ['bateau', "navire|bateau|paquebot|voilier|cuirassé|porte-avions|sous-marin|frégate|croiseur|destroyer|corvette|chalutier|yacht|goélette|caravelle|galion|naufrage|navigat|marine|amiral|corsaire|pirate|port!|ports!|maritime|navale|naval|embarcation|ferry|canot"],
  ['aviation', "avion|aéronef|aéroport|aviat|hélicoptère|compagnie aérienne|planeur|dirigeable|aéronautique|aérien|aérienne|vol!|vols!"],
  ['automobile', "automobile|voiture|constructeur automobile|moto|camion|formule 1|rallye|véhicule|autoroute|route|pilote automobile"],
  ['train', "train|ferroviaire|gare!|gares!|métro!|métros!|tramway|locomotive|chemin de fer|ligne de|rer!|rers!|tgv|réseau de transport"],
  ['espace', "planète|étoile|galaxie|astéroïde|comète|satellite|astronaute|cosmonaute|spatial|spatiale|astronome|astronomie|lune!|lunes!|nébuleuse|constellation|exoplanète|cratère|fusée|sonde|univers!|universs!|système solaire|trou noir"],
  ['géographie', "montagne|mont!|monts!|sommet|rivière|fleuve|lac!|lacs!|île|archipel|mer!|mers!|océan|golfe|détroit|désert|volcan|vallée|plaine|péninsule|baie|cap!|caps!|région|département|province|massif|forêt|cours d'eau|glacier|canyon|plateau|parc national|comté|canton|district|territoire|continent|état fédéré|état des|subdivision|frontière"],
  ['ville', "intercommunalité|commune|ville|village|capitale|municipalité|agglomération|quartier|arrondissement|localité|métropole|bourg!|bourgs!|chef-lieu|cité|hameau|banlieue"],
  ['pays', "état insulaire|état situé|état d'|état membre|pays!|payss!|état souverain|république|nation!|nations!|principauté|monarchie"],
  ['animal', "parc zoologique|zoo!|animal|animaux|espèce d'oiseaux|oiseau|mammifère|poisson|insecte|reptile|amphibien|race de|chien|chat!|chats!|cheval!|chevaux!|araignée|papillon|serpent|requin|baleine|crustacé|mollusque|dinosaure|primate|rongeur|félin|espèce de (?:mammifères|poissons|reptiles|serpents|lézards|grenouilles|papillons|coléoptères|fourmis|insectes|araignées|oiseaux)|genre d'(?:oiseaux|insectes|animaux)|famille d'(?:oiseaux|insectes)|ordre d'|taxon"],
  ['plante', "plante|plantes|arbre|arbuste|fleur!|fleurs!|légume|champignon|algue|végétal|végétale|cultivar|genre de plantes|espèce de plantes|famille de plantes|céréale|graminée|herbe"],
  ['nature', "bois!|nature|naturel|naturelle|espèce|écosystème|climat|météo|écologie|écologique|environnement|biodiversité|réserve|parc naturel|faune|flore"],
  ['alimentation', "biscuit|riz!|pâtissier|patissier|bonbon|sucre|huile|plat!|plats!|cuisine|culinaire|recette|boisson|vin!|vins!|bière|fromage|dessert|gâteau|pâtisserie|aliment|alimentaire|fruit|légume|sauce|spécialité|cuisinier|restaurant|viande|épice|cocktail|alcool|café|thé!|thés!|confiserie|pain!|pains!|soupe|condiment|charcuterie|gastronomie|nourriture|chocolat"],
  ['mode', "costumi|cheveux|chapeau|robe!|robes!|mode!|modes!|styliste|mannequin|vêtement|couturi|maison de couture|haute couture|chaussure|accessoire|coiffure|parfum|bijou|joaillerie|textile"],
  ['économie', "économie|économique|économiste|monnaie|banque|bancaire|bourse|finance|financier|impôt|commerce|crise|indice|marché"],
  ['entreprise', "entreprise|société|marque|groupe industriel|multinationale|fabricant|constructeur|chaîne de|compagnie|start-up|holding|enseigne|homme d'affaires|femme d'affaires|homme d'affaire|femme d'affaire|entrepreneu|pdg|firme|filiale"],
  ['langue', "prénom|nom de famille|patronyme|langue|dialecte|alphabet|écriture|mot!|mots!|expression|linguiste|linguistique|grammaire|lettre|caractère|idiome|vocabulaire"],
  ['éducation', "université|école|lycée|collège|enseignement|établissement|institut|académie|campus|étudiant|diplôme"],
  ['crime', "magistrat|juge!|juges!|avocat|tribunal|justice|policier|police|criminel|tueu|meurtre|assassinat|attentat|terroris|mafia|gang!|gangs!|escroc|braquage|affaire judiciaire|affaire criminelle|prison|enlèvement|crime|scandale|procès|condamné"],
  ['catastrophe', "catastrophe|séisme|tremblement de terre|tsunami|ouragan|cyclone|tempête|éruption|inondation|incendie|accident|naufrage|épidémie|pandémie|famine|explosion|crash|marée noire"],
].map(([tag, re]) => [tag, W(re)]);

// Synonymes : un mot trouvé dans la description ajoute des mots-clés que les règles connaissent.
const SYNONYMS = [
  ["circonscription électorale|relations diplomatiques|consul", 'politique'],
  ['juriste', 'justice ; juge'],
  ['biathlète', 'sportif'],
  ['botaniste', 'plante ; scientifique'],
  ['paléontologue', 'scientifique'],
  ['collembole', 'insecte'],
  ['résistant', 'résistance ; militant'],
  ['cimetière|tombe!|tombes!', 'monument'],
  ['sous-préfecture|freguesia', 'commune'],
  ['épisode', 'série télévisée'],
  ['piano', 'musique'],
  ['romain|romaine|thébain|thébaine', 'antiquité'],
  ['revue!|revues!', 'magazine'],
  ['canal!|canaux!', "cours d'eau"],
  ["appellation d'origine|aire contrôlée", 'aliment'],
  ['lépidoptère|coléoptère|diptère|hyménoptère|hémiptère|orthoptère|odonate|pseudoscorpion|scorpion|arachnide|acarien|gastéropode|bivalve|crabe|fourmi|abeille|guêpe|mouche|moustique|libellule|escargot|nématode|cnidaire|méduse', 'animal'],
  ['gouverneur|gouverneure', 'homme politique'],
  ['édition de wikipédia', 'langue ; site web'],
  ['consonne|voyelle|phonème|consonantique|vocalique', 'langue'],
  ['marais|barrage!|barrages!', 'lac'],
  ['imprimeu|libraire', 'éditeur'],
  ['baron!|baronne|marquis!|marquise|vicomte|chevalier', 'noble'],
  ['festival!|festivals!', 'art'],
  ['disc-jockey|disc jockey|saxophoniste|trompettiste|flûtiste|harpiste|claveciniste|organiste|violoncelliste|hautboïste|bassiste|bluesman|soprano|ténor!|baryton|sonate|quatuor|ep de|maxi!|instrumental|mélodie de|œuvre de [A-Z]', 'musique'],
  ['groupe (?:allemand|américain|britannique|anglais|suédois|français|japonais|canadien|australien|norvégien|finlandais|italien|espagnol|belge|suisse|néerlandais|danois|russe|coréen)|boy band|girl group', 'musique'],
  ['karatéka|taekwondoïste|rameu|céiste|kayakiste|hockeyeu|grimpeu|alpiniste|surfeu|plongeu|bobeu|archère|sprinteu|véliplanchiste|short-track|combiné nordique|all-star game', 'sport'],
  ['ornithologue|entomologiste|zoologiste|naturaliste|anthropologue|biochimiste|famille de ciliés|famille de diatomées|enzyme|famille interpro', 'science'],
  ["opilions|copépodes|tardigrades|bryozoaires|genre fossile|plésiosaures|ptérosaures|corail", 'animal'],
  ['neurologue|dermatologue|ophtalmologue|pharmacien|veine|artère|psychanalyste|épidémiologiste|épidémiologue|sevrage|pancréa', 'médecine'],
  ['samouraï|seigneur|aristocrate|archiduc|khanat|titre de noblesse|famille noble|mois de [0-9]|jour du calendrier|année hébraïque|décennie|chronologie|faits marquants|menhir|dolmen|tumulus|mégalithe', 'histoire'],
  ['patriarche|abbé!|abbesse|prieuré|couvent|chartreuse|collégiale|psaume|torah|talmud', 'religion'],
  ["raïon|oblast|dème|upazila|section de|town!|paroisse civile|aire d'attraction|aire urbaine|lieu-dit|voie de|voie parisienne|espace vert", 'localité'],
  ["col!|grotte|îlot|atoll|fjord|tourbière|méridien|parallèle", 'montagne'],
  ['circonscription|syndicaliste|féministe', 'politique'],
  ['cépage|sommelier|restaurateur|viennoiserie|mets|beignet', 'aliment'],
  ['mangaka|traducteur|traductrice|light novel|prix littéraire', 'littérature'],
  ['néréide|yōkai|yokai', 'mythologie'],
  ['compagnie de jésus|jésuite|congrégation|rinpoché|lama!', 'religion'],
  ['monteuse|monteur de cinéma|chef monteu', 'film'],
  ['lamproie|anguille|esturgeon|truite|saumon', 'poisson'],
  ['villa!|villas!|manoir|demeure', 'bâtiment'],
  ['détecteur|ondes gravitationnelles|télescope|observatoire|accélérateur de particules', 'science'],
  ['communauté (?:arménienne|rurale|urbaine|villageoise)', 'localité'],
  ['hallucination|phantosmie|psychose', 'médecine'],
  ['lapin!|lapins!|lièvre', 'animal'],
  ['algébrique|géométrie|topologie|variété algébrique|polynôme', 'mathématique'],
  ['collectionneu|mécène', 'art'],
  ['bourreau|exécuteur public', 'justice'],
  ['autobus|bus!|trolleybus|réseau de bus', 'véhicule'],
  ['groupe de médias|groupe de presse|groupe audiovisuel|conglomérat', 'entreprise'],
  ['derby!|derbys!', 'sport'],
  ['molière!|molières!', 'théâtre'],
  ['statuette|figurine', 'sculpture'],
  ['événements survenus|événements liés|événements marquants', 'histoire'],
  ["pièce d'|pièce de [A-Z]|tragédie|comédie!", 'pièce de théâtre'],
  ['fossile|homo sapiens|hominidé|paléolithique|néolithique', 'préhistoire'],
  ['norme!|normes!|standard!', 'technologie'],
  ['quotidien!|quotidiens!|hebdomadaire|mensuel!', 'journal'],
  ['éponge!|éponges!', 'animal'],
  ['drone!|drones!', 'aéronef ; militaire'],
  ['néo-nazi|néonazi|nationaliste|suprémaciste', 'politique'],
  ['carcinologiste|malacologiste|herpétologiste|ichtyologiste|arachnologue', 'scientifique ; animal'],
  ['climatologue|météorologue|glaciologue|volcanologue|géologue|océanographe', 'scientifique'],
  ['monteur sonore|ingénieur du son|concepteur sonore', 'cinéma'],
  ['dominicain français|frère dominicain|franciscain|bénédictin', 'religieux'],
  ['région viticole|vignoble|viticole|appellation viticole', 'vin'],
  ['variété de (?:poire|pomme|raisin|cerise|prune|pêche|figue|agrume|tomate|pomme de terre)', 'fruit ; plante'],
  ['tribu!|tribus!|clan!', 'peuple'],
  ['accord!|accords!|cartel!', 'traité'],
  ['vulv|pénis|anatomique|sillon', 'anatomie'],
  ['khan de|khan des|khanat', 'monarque'],
  ['négociant|colon!|colons!', 'colonie'],
  ['verre!|type de verre|matériau|alliage', 'technique'],
  ['neuroscience|neurone|neuronal|synap', 'science ; médecine'],
  ['fortification|bastion', 'forteresse ; militaire'],
  ['réfugié|camp de réfugiés', 'politique'],
  ['hacker|pirate informatique|cyberattaque|cybercriminel', 'informatique ; crime'],
  ['politico-financière|politico-financier', 'scandale ; politique'],
  ['sulfure|oxyde|minerai|cristal!|cristaux', 'minéral'],
  ['accordéoniste|percussionniste|contrebassiste|clarinettiste|tromboniste|altiste|luthiste|discographie', 'musique'],
  ['envoyé|ambassadeu', 'diplomate'],
  ['aérodrome', 'aéroport'],
  ['maison à|maison au|maison de maître|maison natale', 'bâtiment'],
  ['microrégion|mésorégion', 'région'],
  ['architectural|architecturale', 'architecture'],
  ['pourim|hanoucca|fête juive|fête religieuse|concile', 'religion'],
  ['louvre|exposées|exposition d\'art', 'musée'],
  ['dalaï-lama|chef spirituel|évèque', 'religion'],
  ['cristallograph|maille élémentaire|réseau cristallin', 'physique'],
  ['artéfact|artefact|vestige|trésor archéologique', 'archéologie'],
  ['sceptique|scepticisme|zététique|rationaliste', 'science'],
  ['cercle d(?:u|e la|e l\'|e) (?:Mali|Sénégal|Niger|Burkina|Guinée)', 'subdivision ; localité'],
  ['ruisseau|torrent|affluent', "cours d'eau"],
  ['mafieux|mafieuse|cosa nostra|camorra|ndrangheta|yakuza|triade!', 'mafia ; crime'],
  ['drapeau', 'symbole national ; pays'],
  ['centre commercial|grand magasin|supermarché|hypermarché', 'entreprise ; commerce'],
  ['logique mathématique|formule logique|booléen|calcul propositionnel', 'mathématique'],
  ['éclipse', 'astronomie'],
  ['mycologue|mycologie', 'champignon ; scientifique'],
  ['anoure|anoures|urodèle', 'amphibien'],
  ['usine|manufacture|coutellerie|forges!', 'entreprise ; industrie'],
  ['artiste lyrique|chanteuse lyrique|chanteur lyrique', 'opéra!'],
  ["compilation de|symphonie|chœur|choeur|chorale|groupe de (?:[\\p{L}-]+ )?(?:metal|punk|folk|hard rock|reggae|ska)!", 'musique'],
  ['triathlète|pongiste|volleyeu|curleu|skipper|matador|bobsleigh|sambo!|jeux européens|sauteu|fondeu', 'sport'],
  ['skipper', 'voilier'],
  ['paramilitaire|mitrailleuse', 'militaire'],
  ['statistique|nombre complexe|théorème|lemme!|conjecture', 'mathématique'],
  ['saucisse|sandwich', 'aliment'],
  ['prise d\'otages|fusillade', 'crime'],
  ['automotrice|grande vitesse', 'ferroviaire'],
  ['bataille|affrontement', 'guerre'],
  ['^[0-9]{3,4} (?:en|au|aux) ', 'histoire'],
  ['orchidée|jardin botanique', 'plante'],
  ['sentier de (?:grande )?randonnée', 'massif'],
  ['aires? protégées?|parcs? d\'état', 'parc naturel'],
  ['genre éteint', 'animal'],
  ['hydravion', 'avion'],
  ['programme apollo|programme spatial|mission spatiale|vol spatial', 'spatial'],
  ['centre hospitalier', 'hôpital'],
  ['informaticien', 'informatique'],
  ['télécommunication', 'technologie'],
  ['monde de fiction', 'littérature'],
  ['désastre', 'catastrophe'],
  ['agence fédérale|agence gouvernementale|agence d\'état', 'gouvernement'],
  ['mineraux', 'minéral'],
  ['stéréoscop|photographies!', "œuvre d'art"],
  ['designer!|designers!|design!', 'art'],
  ['chronobiolog|chronopsycholog|rythmes? (?:biologiques?|comportementaux|circadiens?)', 'science ; psychologie'],
  ['orgue!|orgues!', 'instrument de musique'],
  ['autorité des transports|transports? (?:en commun|publics?)', 'réseau de transport'],
  ['plasmide|génome|génétique|adn!', 'biologie'],
  ['snowboardeu|snowboarder|skeletoneu|vététiste|haltérophile|kick-boxeu', 'sport'],
  ['funambule', 'cirque'],
  ['caméraman|court-métrage', 'cinéma'],
  ['librettiste|cantate|mini-album|studio d\'enregistrement', 'musique'],
  ['écologue', 'écologie ; scientifique'],
  ['probabiliste|polyèdre|fonction dérivable', 'mathématique'],
  ['romaniste|grammairien|figure de style', 'linguistique'],
  ['médiéviste|gladiateur|maharaja|sultan!|margrave|landgrave|exposition universelle|auschwitz|fonction sociale de cour', 'histoire'],
  ['anthropologiste|astrophysicien|graphologue|famille de protistes|organisme de recherche|radiotélescope|objet transneptunien', 'science'],
  ['objet transneptunien|radiotélescope', 'astronomie'],
  ['littérateur|érudit!|tome!|tomes!|mémoires de|tabloïd|webcomic|bibliothèque', 'littérature'],
  ['infirmier|infirmière|état pathologique|douleur!|ligaments?!|os!|système digestif|malentendant|état de conscience', 'médecine'],
  ['banquier|banquière|minimum social', 'économie'],
  ['promoteur immobilier|prestation de service', 'entreprise'],
  ['haut fonctionnaire|haute fonctionnaire|représentant!|représentante!|chambre haute|chambre basse|législature|ministère|code juridique|trotskiste|communiste!|système administratif|pair de france', 'politique'],
  ['système judiciaire|condamnation|agression', 'justice ; crime'],
  ['éditrice', 'éditeur'],
  ['pédagogue', 'enseignement'],
  ['siège titulaire|évêché', 'religion'],
  ['caverne|chenal|plage!|colline|zone géographique|refuge gardé|alpes!', 'région ; montagne'],
  ['khet!|bourgade', 'localité'],
  ['square!|impasse', 'rue'],
  ['autoroutier|échangeur', 'autoroute'],
  ['monorail|funiculaire|s-bahn', 'ferroviaire'],
  ['turboréacteur', 'aéronautique'],
  ['nom de couleur|couleur!|genre artistique|estampe|polyptyque', 'art'],
  ['personnage (?:de la |de l\'|des |du |de )', 'personnage de fiction'],
  ['sculptrice', 'sculpture'],
  ['race (?:ovine|bovine|porcine|caprine|chevaline|canine|féline)|étalon!|jument|holothurie', 'animal'],
  ['circuit intégré', 'électronique'],
  ['vestimentaire|sandale', 'vêtement'],
  ['œuf!|œufs!', 'aliment'],
  ['état non reconnu', 'état souverain'],
  ['ministère de la défense|défense américain', 'militaire'],
].map(([re, add]) => [W(re), add]);

// Expressions qui contiennent un mot trompeur, dans le titre comme dans la description :
// on les remplace avant de chercher les mots-clés (« Charente-Maritime » n'est pas un bateau).
const fixWords = s => s
  .replace(/[’ʼ]/g, "'")
  .replace(/(?:Charente|Seine|Loire)-Maritime|Alpes-Maritimes/g, 'département')
  .replace(/pays de Galles/gi, 'Galles')
  .replace(/-sur-Mer/gi, '')
  .replace(/^tableau des /i, 'liste des ')
  .replace(/Compagnie de Jésus/gi, 'jésuites')
  .replace(/supérieur général/gi, 'supérieur religieux')
  .replace(/Tour de France/g, 'course de cyclisme')
  .replace(/Tour (?:d'|de |du )(?:Italie|Espagne|Suisse|Romandie|Belgique|Pologne|Flandre|Catalogne|Grande-Bretagne|Turquie|Algérie|Maroc|Tunisie|Autriche|Luxembourg|Norvège|Danemark|Slovénie|Croatie|Oman|Qatar|Chine|Rwanda|Burkina Faso)/g, 'course de cyclisme')
  .replace(/univers (?:de |d'|du )(?=[A-Z])/g, 'monde de fiction de ')
  .replace(/arts martiaux/gi, 'sports de combat');

// Description utilisée : celle de WikiMasters, sinon la première phrase Wikipédia (`wp`), enrichie des synonymes.
function normalize(card) {
  let d = fixWords(card.d || card.wp || '')
    .replace(/census-designated place/gi, 'localité des États-Unis')
    .replace(/établissement humain/gi, 'localité')
    .replace(/album de bande dessinée/gi, 'bande dessinée')
    .replace(/match des étoiles/gi, 'all-star game')
    .replace(/artère (?:de la ville|de la cité|principale|commerçante)/gi, 'voie de la ville')
    .replace(/lancer du disque/gi, 'lancer athlétique')
    .replace(/divisions? (?:territoriales?|administratives?)/gi, 'subdivision')
    .replace(/lutte contre/gi, 'combat contre')
    .replace(/dispositifs? (?:judiciaires?|policiers?|juridiques?)(?: et (?:judiciaires?|policiers?|juridiques?))?/gi, 'mesures de justice')
    .replace(/course (?:hippique )?de plat/gi, 'course hippique')
    .replace(/institut de sondage/gi, 'entreprise de sondage')
    .replace(/institut de recherche/gi, 'centre de recherche scientifique')
    .replace(/(?:homme|femme)s? de lettres/gi, 'écrivain')
    .replace(/course cycliste/gi, 'course de cyclisme')
    .replace(/commune nouvelle/gi, 'commune')
    .replace(/chaînes? de montagnes?/gi, 'massif')
    .replace(/chaîne d'/gi, 'chaîne de ')
    .replace(/loi (?:de probabilité|statistique)/gi, 'distribution mathématique')
    .replace(/commune politique/gi, 'commune')
    .replace(/zone (?:de gouvernement local|d'administration locale)/gi, 'localité')
    .replace(/musique électronique/gi, 'musique électro')
    .replace(/clans? mafieux/gi, 'organisation mafieuse')
    .replace(/expressions? logiques?/gi, 'formule logique')
    .replace(/(?:centre )?hôpital universitaire|centre hospitalier universitaire/gi, 'hôpital')
    .replace(/équipe cycliste/gi, 'équipe de cyclisme')
    .replace(/division d'(?:algues|plantes|champignons)/gi, "groupe d'algues")
    .replace(/unité urbaine/gi, 'localité')
    .replace(/chambre des communes/gi, 'chambre basse')
    .replace(/nébuleuse en émission/gi, 'nébuleuse émissive')
    .replace(/véhicule spatial/gi, 'engin spatial')
    .replace(/câbles? sous-marins?/gi, 'câble de télécommunication')
    .replace(/division stratigraphique/gi, 'étage géologique')
    .replace(/gène de l'espèce homo sapiens/gi, 'gène humain');
  // Les synonymes regardent aussi le titre (« Molière seul(e) en scène » n'a qu'une description vague).
  const t = fixWords(card.t || '');
  const extra = SYNONYMS.filter(([re]) => re.test(d) || re.test(t)).map(([, add]) => add);
  return {t, d, extra: extra.join(' ; ')};
}

const ORDER = Object.fromEntries(RULES.map(([t], i) => [t, i]));

function classify(raw) {
  const card = normalize(raw);
  const t = card.t || '';
  // Les pages de liste ou d'homonymie n'ont pas de vraie description : seul le titre compte.
  const meta = /page (?:de liste|d'homonymie)/i.test(card.d || '') || /\(homonymie\)/i.test(t);
  // Le qualificatif entre parenthèses du titre, « (série télévisée) », vaut une description.
  const paren = (t.match(/\(([^)]+)\)\s*$/) || [])[1] || '';
  const d = [meta ? '' : card.d, paren, card.extra].filter(Boolean).join(' ; ');
  const titleWeight = d ? 1 : 2;
  const scores = {};
  for (const [tag, re] of RULES) {
    let s = 0;
    const m = re.exec(d);
    if (m) s += 2 + (m.index < 25 ? 1 : 0); // le nom principal ouvre souvent la description
    if (re.test(t)) s += titleWeight;
    if (s) scores[tag] = s;
  }
  if (/^histoire d/i.test(t)) scores.histoire = (scores.histoire || 0) + 3;
  const family = /^famille /i.test(t);
  if (family) scores.histoire = (scores.histoire || 0) + 3;
  const person = !meta && !family && PERSON.test(d);
  // Une personne n'est ni un lieu ni un bâtiment : on retire les faux positifs fréquents.
  if (person) for (const x of ['ville', 'pays', 'géographie', 'architecture', 'nature']) if (!(x === 'architecture' && /architecte|paysagiste|urbaniste/i.test(d))) delete scores[x];
  // Les espèces précises priment sur le tag générique « nature ».
  if (scores.animal || scores.plante) delete scores.nature;
  const ranked = Object.keys(scores).sort((a, b) => scores[b] - scores[a] || ORDER[a] - ORDER[b]);
  // Un tag secondaire doit venir de la description : un mot du seul titre (« Religieuse (pâtisserie) ») ne suffit pas.
  if (d && scores[ranked[0]] >= 2) for (let i = ranked.length - 1; i > 0; i--) if (scores[ranked[i]] < 2) ranked.splice(i, 1);
  let tags = person ? ['personnalité', ...ranked.slice(0, 2)] : ranked.slice(0, 3);
  // Album, chanson, single… : une œuvre musicale n'est ni une personne ni une guerre, quel que soit son titre.
  if (/^(?:tableau|peinture|portrait|gravure|fresque|aquarelle|lithographie)(?!\p{L})/iu.test(d.replace(/^[^,;]*? est (?:un |une |le |la )/i, ''))) tags = ['art', ...tags.filter(x => x !== 'personnalité' && x !== 'art')].slice(0, 3);
  if (/^(?:album|chanson|single|ep|maxi|cantate|compilation|[0-9]+e single|dvd live)(?!\p{L})/iu.test(d.replace(/^[^,;]*? est (?:un |une |le |la )/i, ''))) tags = ['musique'];
  const best = ranked.length ? scores[ranked[0]] : 0;
  // Sans description, le titre seul (score 1) ne suffit pas.
  if (best < 2 && !person) tags = ['à classer'];
  return {tags, score: best};
}

if (typeof module !== 'undefined') module.exports = {classify, RULES};
if (typeof window !== 'undefined') window.classify = classify;
