// Chargement des modules 
var express = require('express');
var app = express();
var server = app.listen(8080, function() {
    console.log("C'est parti ! En attente de connexion sur le port 8080...");
});

// Ecoute sur les websockets
var io = require('socket.io').listen(server);

// Configuration d'express pour utiliser le répertoire "public"
app.use(express.static('public'));
// set up to 
app.get('/', function(req, res) {  
    res.sendFile(__dirname + '/public/chat.html');
});



/*** Gestion des clients et des connexions ***/
var clients = {};       // id -> socket


/** Gestion des parties et des joueurs **/

var joueurs = [[]]; //[indice_partie][joueurs]
var ias = [[]]; //[indice_partie][ias_joueurs]
var scores = [[]]; //[indice_partie][score_joueur]
var isCouche = [[]];//[indice_partie][isCouche_joueur]
var partie=1; //indice de la partie qu'on peut créer
var dispos=[]; //indice(s) des parties réutilisable
var launched=[true]; //pour savoir si une partie est lancé ou non
var last=0;
// Quand un client se connecte, on le note dans la console
io.on('connection', function (socket) {
    
    // message de debug
    console.log("Un client s'est connecté");
    var currentID = null;
    
    /**
     *  Doit être la première action après la connexion.
     *  @param  id  string  l'identifiant saisi par le client
     */
    socket.on("login", function(id) {
        while (clients[id]) {
            id = id + "(1)";   
        }
        currentID = id;
        clients[currentID] = socket;
        
        console.log("Nouvel utilisateur : " + currentID);
        // envoi d'un message de bienvenue à ce client
        socket.emit("bienvenue", id);

        // envoi aux autres clients 
        socket.broadcast.emit("message", { from: null, to: null, text: currentID + " a rejoint la discussion", date: Date.now(),id_partie:0 } );
        // envoi de la nouvelle liste à tous les clients connectés
        io.sockets.emit("liste", Object.keys(clients));
        socket.emit("invitation",{partie:partie,from:null});
    });

    /**
     *  Réception d'un message et transmission à tous.
     *  @param  msg     Object  le message à transférer à tous
     */

    socket.on("message", function(msg) {
        if(msg.id_partie==null || msg.id_partie===undefined){
            msg.id_partie=0;
        }
        console.log("Reçu message");
        // si jamais la date n'existe pas, on la rajoute
        msg.date = Date.now();

        if(msg.id_partie===0) {
            if (msg.to != null && clients[msg.to] !== undefined) {
                console.log(" --> message privé");
                clients[msg.to].emit("message", msg);
                if (msg.from !== msg.to) {
                    socket.emit("message", msg);
                }
            } else {
                console.log(" --> broadcast");
                io.sockets.emit("message", msg);
            }
        }else{
            if (msg.to != null && existInJoueurs(msg.id_partie, msg.to)) {
                console.log(" --> message privé partie n° "+msg.id_partie);
                clients[msg.to].emit("message", msg);
                if (msg.from !== msg.to) {
                    socket.emit("message", msg);
                }
            } else{
                console.log(" --> broadcast partie n° "+msg.id_partie);
                for(let i in joueurs[msg.id_partie]){
                    clients[joueurs[msg.id_partie][i]].emit("message", msg);
                }

            }
        }
    });

    /**
     * Reçu quand un joueur souhaite inviter d'autre personnes
     * Elle va envoyer à toutes les personnes invitées le nom de la personne qui les a invités
     * @param Object invit Indice de partie actualisé, from
     */

    socket.on("invitation",function(invit){
        let partieF;
        let shifted=false;

        if(dispos.length===0){
            if(last===partie){
                partie++;
            }
            partieF=partie;
        }else{
            partieF=dispos[0];
            if(last<dispos[0]){
                last=dispos[0];
            }

            shifted=true;
        }

        if(invit===null){
            io.sockets.emit("invitation",{partie:partieF,from:null});

        }else {
            let inv = {
                partie: partieF,
                from: invit.from
            };
            console.log("Invitation envoyé par " + inv.from + " partie num = " + partieF);
            socket.emit("invitation", inv);
            for (let i in invit.to) {
                clients[invit.to[i]].emit("invitation", inv);
            }
            launched[partieF]=false;
            if(!shifted){
                partie++;
            }else{
                dispos.shift();
            }
        }
    });

    /**
     * Reçu quand un joueur rejoint une partie
     * On va alors l'ajouter à toutes nos variables qui gère les parties
     * @param Object invit Indice de partie, joueur qui rejoint
     */

    socket.on("joinGame",function(invit){
        console.log("partie rejointe par"+invit.joiner);
        if(joueurs[invit.partie]=== undefined){
            joueurs[invit.partie]=[];
        }
        if(scores[invit.partie] === undefined){
            scores[invit.partie] =[];
        }
        if(isCouche[invit.partie] === undefined){
            isCouche[invit.partie] = [];
        }
        if(ias[invit.partie]  === undefined){
            ias[invit.partie] = [];
        }

        joueurs[invit.partie].push(invit.joiner);
        scores[invit.partie].push(0);
        isCouche[invit.partie].push(false);

        let liste ={
            joueurs:joueurs[invit.partie],
            id_partie:invit.partie
        };
        for(let i in joueurs[invit.partie]){
            if(joueurs[invit.partie][i]!==undefined && clients[joueurs[invit.partie][i]] != undefined) {
                clients[joueurs[invit.partie][i]].emit("listeGame", liste);
                clients[joueurs[invit.partie][i]].emit("message", { from: null, to: null, text: currentID + " a rejoint la partie", date: Date.now(),id_partie:invit.partie });
            }
        }
        console.log(joueurs);
    });

    /**
     * Reçu quand l'hôte d'une partie la lance, on va alors envoyer la position des crânes pour chacun et commencer le 1er tour
     * @param partieLancee Indice de la partie
     */

    socket.on("initialiserPartie",function(partieLancee){
        io.sockets.emit("suppressionInvitation",partieLancee);
        let cranes = [];
        for(let j=0;j<joueurs[partieLancee].length;j++){
            let rand_crane = Math.floor(Math.random()*4);
            cranes.push(rand_crane);
        }
        for(let i in joueurs[partieLancee]){
            clients[joueurs[partieLancee][i]].emit("iniPartie",{partieLancee:partieLancee, cranes:cranes});
        }
        jouer(partieLancee);
        launched[partieLancee]=true;

    });

    /**
     * Reçu quand un joueur joue une carte de sa main,
     * on va alors envoyer à tout les joueurs de la même partie la carte à actualiser sur le plateau
     * on va lancer une nouvelle manche
     * @param obj Object Indice de partie, la carte à actualiser, le joueur qui a posé sa carte
     */

    socket.on("carteSelectionnee",function(obj) {
        let partieLancee = obj.partieEnCours;
        let prochainJoueur =choixJoueur(partieLancee,obj.joueur);

        for (let i in joueurs[partieLancee]) {
            clients[joueurs[partieLancee][i]].emit("nouvelManche", {
                partieLancee: partieLancee,
                joueur: obj.joueur,
                prochainJoueur: prochainJoueur,
                carte: obj.carte
            });
        }
        if(isIA(partieLancee,prochainJoueur)){
            iaJoue(partieLancee,prochainJoueur);
        }

    });

    /**
     * Reçu quand un joueur est entrain des révéler les cartes des piles
     * Si jamais il a fini il a alors soit gagné la manche soit perdu
     * @param obj Object Indice de partie, joueur qui révèle, le joueur à qui on a cliqué sur la pile, la carte cliquée
     */

    socket.on("carteSelectionneePile",function(obj) {
        let partieLancee = obj.partieEnCours;
        for(let i=0;i< joueurs[partieLancee].length;++i){
            clients[joueurs[partieLancee][i]].emit("pileVersDefausse",{partieLancee:partieLancee, joueur:obj.joueur, pileDeJoueur:obj.pileDeJoueur, carte:obj.carte });
        }
        if(obj.gagne){
            let indiceScoreJoueur = getIndiceJoueurTab(obj.joueur,partieLancee);
            let scoreJoueur = (scores[partieLancee][indiceScoreJoueur])+1;
            scores[partieLancee][indiceScoreJoueur]+=1;
            IAdelete(partieLancee);
            victoire(partieLancee,obj.joueur,scoreJoueur);


        }
        if(obj.perdu){
            IAdelete(partieLancee);
            defaite(partieLancee,obj.joueur,obj.pileDeJoueur);
        }
        console.log(scores[partieLancee]);
    });

    /**
     * Reçu quand un joueur mise
     * S'il s'agit de la mise finale (nombre de cartes dans les piles == mise) alors il pourra révéler les cartes
     * @param mise Object Indice de parie, joueur qui mise, la mise
     */

    socket.on("mise",function(mise){
        let partieLancee = mise.partieEnCours;
        let prochainJoueur="";
        if(mise.miseFinale){
            prochainJoueur = mise.joueur;
        }else {
            prochainJoueur = choixJoueur(partieLancee, mise.joueur);
        }

        for (let i in joueurs[partieLancee]) {

            clients[joueurs[partieLancee][i]].emit("mise", {
                partieLancee: partieLancee,
                joueur: mise.joueur,
                prochainJoueur: prochainJoueur,
                mise: mise.mise
            });
        }
        console.log("Prochain joueur à miser : "+prochainJoueur);
        if(isIA(partieLancee,prochainJoueur)){
            console.log("Ia doit miser");
            iaMise(partieLancee,prochainJoueur,false,mise.mise, mise.miseFinale);
        }else {
            for (let i in joueurs[partieLancee]) {

                if (mise.miseFinale) {
                    clients[joueurs[partieLancee][i]].emit("revelation", {
                        partieLancee: partieLancee,
                        joueur: mise.joueur,
                        mise: mise.mise
                    });
                }
            }
        }
    });

    /**
     * Reçu quand un joueur se couche, on va alors désigner un prochain joueur
     * Cependant s'il reste qu'un seul joueur debout ce sera à lui de jouer et de révéler les cartes
     * @param obj Object Indice de partie, joueur se couchant
     */

    socket.on("seCouche",function(obj){

        let partieLancee = obj.partieEnCours;
        let prochainJoueur="";
        let indice = getIndiceJoueurTab(obj.joueur,partieLancee);
        isCouche[partieLancee][indice]=true;
        let cpt=0;
        let indice_joueur_debout=0;
        for(let i=0;i<isCouche[partieLancee].length;i++){
            if(!isCouche[partieLancee][i]){
                indice_joueur_debout=i;
                cpt++;
            }
        }
        console.log("cpt = "+cpt);
        console.log(isCouche[partieLancee]);
        console.log("joueurs[game][indice_debout] = "+joueurs[partieLancee][indice_joueur_debout]);
        prochainJoueur = choixJoueur(partieLancee, obj.joueur);
        for (let i = 0; i < joueurs[partieLancee].length; ++i) {
            clients[joueurs[partieLancee][i]].emit("joueurSeCouche", {
                partieLancee: partieLancee,
                joueur: obj.joueur,
                prochainJoueur: prochainJoueur
            });
        }

        if(cpt===1) {
            /*for (let i = 0; i < joueurs[partieLancee].length; ++i) {
                clients[joueurs[partieLancee][i]].emit("joueurSeCouche", {
                    partieLancee: partieLancee,
                    joueur: obj.joueur,
                    prochainJoueur: prochainJoueur
                });
            }*/
            if (isIA(partieLancee, joueurs[partieLancee][indice_joueur_debout])) {
                iaRevelation(partieLancee, joueurs[partieLancee][indice_joueur_debout]);
            } else {

                for (let i = 0; i < joueurs[partieLancee].length; i++) {
                    clients[joueurs[partieLancee][i]].emit("revelation", {
                        partieLancee: partieLancee,
                        joueur: joueurs[partieLancee][indice_joueur_debout],
                        mise: obj.mise
                    });
                }
            }
        }else {
            if(isIA(partieLancee,prochainJoueur)){
                iaMise(partieLancee,prochainJoueur,false,obj.mise);
            }else {
                for (let i = 0; i < joueurs[partieLancee].length; ++i) {
                    clients[joueurs[partieLancee][i]].emit("joueurSeCouche", {
                        partieLancee: partieLancee,
                        joueur: obj.joueur,
                        prochainJoueur: prochainJoueur
                    });
                }
            }

        }


    });

    /**
     * Reçu quand un joueur ayant perdu se fait retirer une carte (par lui-même ou le joueur sur lequel il a pioché un crâne)
     * On va alors envoyer à tout les joueurs de la même partie la carte qui va être retirer du jeu
     * @param obj Object Indice de partie, joueur qui perd sa carte, la carte en question
     */

    socket.on("carteARetirer",function(obj){
        let partieLancee = obj.partieEnCours;

        for(let i=0;i< joueurs[partieLancee].length;++i){
            clients[joueurs[partieLancee][i]].emit("carteRetiree",{partieLancee:partieLancee, joueur:obj.joueur, carte:obj.carte });
        }


    });

    /**
     * Reçu quand un joueur n'a plus de carte, il est alors éliminé de la partie et va la quitter
     * @param obj Object Indice de partie, joueur éliminé
     */

    socket.on("joueurElimine",function(obj){
        let partieLancee = obj.partieEnCours;
        for(let i=0;i< joueurs[partieLancee].length;++i){
            clients[joueurs[partieLancee][i]].emit("joueurElimine",{partieLancee:partieLancee, joueur:obj.joueur,elimine:obj.elimine });
        }

    });

    /**
     * Reçu quand un joueur répond au serveur pour lui dire si une telle carte est un crâne ou non
     * Cette fonction sert pour les IA qui vont reçevoir leur réponse si la carte qu'ils ont pioché est un crâne ou non
     * Vu que l'IA pioche forcément qu'une seule carte alors on peut directement déterminer si elle a perdu ou gagné
     *  @param obj Object Joueur qui a demandé l'information, Indice de partie
     */

    socket.on("carteCrane",function(obj){
        console.log("joueur dans on.carteCrane "+obj.joueur);
        console.log("isCrane"+obj.isCrane);
        if(obj.isCrane){
            defaite(obj.partieEnCours,obj.joueur,null);
        }else{
            console.log("Victoire de l'IA "+obj.joueur);
            let index = getIndiceJoueurTab(obj.joueur,obj.partieEnCours);
            scores[obj.partieEnCours][index]+=1;
            victoire(obj.partieEnCours,obj.joueur,scores[obj.partieEnCours][index]);
        }

    });

    /**
     * Détermine qui sera le prochain joueur
     * @param partie
     * @param joueurActuel
     * @returns le prochain joueur
     */

    function choixJoueur(partie,joueurActuel){
        if(joueurActuel===null){
            return joueurs[partie][0];
        }

        for(let j=0;j<joueurs[partie].length;j++){
            if(joueurs[partie][j] === joueurActuel){
                j++;
                if(j===joueurs[partie].length){
                    j=0;
                }
                while(isCouche[partie][j]){
                    j++;
                    if(j===joueurs[partie].length){
                        j=0;
                    }
                }
                return joueurs[partie][j];

            }
        }
    }

    /**
     * @param partieEnCours
     * @param joueur
     * @returns {boolean} si le joueur est encore dans la partie ou non
     */

    function existInJoueurs(partieEnCours, joueur){
        for(let i =0; i < joueurs[partieEnCours].length;i++){
            if(joueurs[partieEnCours][i]===joueur){
                return true;
            }
        }
        return false;
    }

    /**
     * Retourne l'indice du joueur dans le tableau des joueurs
     * @param nomJoueur
     * @param partieEnCours
     * @returns {number}
     */

    function getIndiceJoueurTab(nomJoueur, partieEnCours) {
        for (let i = 0; i < joueurs[partieEnCours].length; i++) {
            if (nomJoueur === joueurs[partieEnCours][i]) {
                return i;
            }
        }
    }

    /**
     * Permet d'envoyer à tout les joueurs de la même partie le début de la manche
     * @param partieLancee
     */

    function jouer(partieLancee){
        let rand = Math.floor(Math.random()*(joueurs[partieLancee].length-1));

        for(let i=0;i<joueurs[partieLancee].length;i++){
            clients[joueurs[partieLancee][i]].emit("debutManche",{num_partie:partieLancee, joueur:joueurs[partieLancee][rand]});
        }
    }

    /**
     * S'effectue quand un joueur à perdu une manche
     * On réinitialise les joueurs couchés et on réinitialise l'état du jeu pour tout les joueurs
     * Un nouveau joueur est désigné (celui qui retire la carte) et une nouvelle manche est lancée
     * @param partieEnCours
     * @param joueur Joueur qui a perdu
     * @param doitEnleverCarte Joueur qui doit enlever la carte
     */

    function defaite(partieEnCours, joueur, doitEnleverCarte){
        let IA = false;
        if(isIA(partieEnCours,joueur)){
            IAdelete(partieEnCours);
            IA=true;
        }
        let prochainJoueur="";
        if(doitEnleverCarte===null){
            prochainJoueur= choixJoueur(partieEnCours,null);
        }else{
            prochainJoueur=doitEnleverCarte;
        }

        if(isIA(partieEnCours,doitEnleverCarte)){
            doitEnleverCarte=null;
        }

        for(let i=0;i<isCouche[partieEnCours].length;i++){
            isCouche[partieEnCours][i]=false;
        }

        for(let i=0; i<joueurs[partieEnCours].length;i++){

            clients[joueurs[partieEnCours][i]].emit("resetManche",
                {partieLancee:partieEnCours,
                    joueur:joueur,
                    victoire:false,
                    victoireTotale:false,
                    prochainJoueur:prochainJoueur});

            clients[joueurs[partieEnCours][i]].emit("perdManche",
                {perdant:joueur,
                    partieLancee:partieEnCours,
                    IA:IA,
                    doitEnleverCarte:doitEnleverCarte});
        }
    }

    /**
     * S'effectue quand un joueur gagne une manche
     * Si c'est son 2ème point alors la partie est terminée et tout le monde sera forcé de la quitter
     * Sinon on réinitialise la partie pour tout les joueurs et on commence une nouvelle manche
     * @param partieEnCours
     * @param joueur Qui a gagné la manche
     * @param points Du joueur ayant gagné la manche
     */

    function victoire(partieEnCours,joueur,points){
        let iaWon=joueur;
        if(isIA(partieEnCours,joueur)){
            console.log("l'IA "+joueur+" gagne la manche");
            IAdelete(partieEnCours);
            iaWon=null;
        }


        for(let i=0;i<isCouche[partieEnCours].length;i++){
            isCouche[partieEnCours][i]=false;
        }
        let vt=false;
        if(points===2){
            vt=true;
        }

        for(let i=0; i<joueurs[partieEnCours].length;i++) {

            clients[joueurs[partieEnCours][i]].emit("gagneManche",
                {
                    vainqueur: joueur,
                    partieLancee: partieEnCours,
                    points: points
                });

            clients[joueurs[partieEnCours][i]].emit("resetManche",
                {
                    joueur:joueur,
                    partieLancee: partieEnCours,
                    prochainJoueur: choixJoueur(partieEnCours, iaWon),
                    victoire:true,
                    victoireTotale:vt
                });
        }
    }

    /**
     * @param partieLancee
     * @param joueur
     * @returns {number} Index de l'IA dans le tableau d'IAs
     */

    function indiceIA(partieLancee,joueur){
        for(let i=0;i<ias[partieLancee].length;i++){
            if(ias[partieLancee][i].joueur === joueur){
                return i;
            }
        }
        return -1;
    }

    /**
     * S'effectue quand c'est au tour d'une IA de poser une carte de sa main
     * Si elle n'a plus de carte alors l'IA mise
     * On boucle dessus si le prochain joueur est une IA
     * @param partieLancee
     * @param joueur Le nom du joueur que l'IA possède
     */

    function iaJoue(partieLancee,joueur){
        if(ias[partieLancee][indiceIA(partieLancee,joueur)].cartes.length ===0){
            iaMise(partieLancee,joueur,true,1);
            return;
        }
        let rand = Math.floor(Math.random()*ias[partieLancee][indiceIA(partieLancee,joueur)].cartes.length);
        let carte = ias[partieLancee][indiceIA(partieLancee,joueur)].cartes[rand];
        let prochainJoueur =choixJoueur(partieLancee,joueur);
        ias[partieLancee][indiceIA(partieLancee,joueur)].cartesPile.push(carte);
        ias[partieLancee][indiceIA(partieLancee,joueur)].cartes.splice(rand,1);
        for (let i in joueurs[partieLancee]) {
            clients[joueurs[partieLancee][i]].emit("nouvelManche", {
                partieLancee: partieLancee,
                joueur: joueur,
                prochainJoueur: prochainJoueur,
                carte: carte
            });
        }
        if(isIA(partieLancee,prochainJoueur)){
            iaJoue(partieLancee,prochainJoueur);
        }
    }

    /**
     * Quand la manche est terminée on va alors supprimer toutes les IA du jeu pour une partie donnée
     * @param partieLancee
     */

    function IAdelete(partieLancee){
        while(ias[partieLancee].length>0){
            let joueur = ias[partieLancee].pop().joueur;
            quitGame(joueur,partieLancee,null,null,null,true,false,false);
        }
    }

    /**
     * Permet de savoir si un joueur est une IA
     * @param partieLancee
     * @param joueur
     * @returns {boolean} est une IA ou non
     */

    function isIA(partieLancee, joueur){
        console.log("ias : "+ias);
        if(ias[partieLancee]!==undefined) {
            if (ias[partieLancee].length > 0) {
                return indiceIA(partieLancee, joueur) !== -1;
            }
        }
        return false;
    }

    /**
     * S'effectue quand l'IA doit miser
     * La majorité du temps elle va directement se coucher
     * Cependant si elle doit miser en 1ère car elle n'a plus de carte elle misera toujours 1
     * @param partieLancee
     * @param joueur Considéré comme une IA
     * @param doitMiser Pour savoir si l'IA doit miser ou non
     * @param mise
     * @param miseFinale
     */

    function iaMise(partieLancee,joueur,doitMiser,mise,miseFinale){
        let index = getIndiceJoueurTab(joueur,partieLancee);
        let prochainJoueur;

        if(!doitMiser){
            console.log("l'ia se couche");
            isCouche[partieLancee][index] = true;
            prochainJoueur = choixJoueur(partieLancee, joueur);
            let cpt=0;
            let indice_joueur_debout=0;
            for(let i=0;i<isCouche[partieLancee].length;i++){
                if(!isCouche[partieLancee][i]){
                    indice_joueur_debout=i;
                    cpt++;
                }
            }

            for (let i = 0; i < joueurs[partieLancee].length; i++) {
                clients[joueurs[partieLancee][i]].emit("joueurSeCouche", {
                    partieLancee: partieLancee,
                    joueur: joueur,
                    prochainJoueur: prochainJoueur
                });
            }

            if(cpt===1) {

                if (isIA(partieLancee, joueurs[partieLancee][indice_joueur_debout])) {
                    iaRevelation(partieLancee, joueurs[partieLancee][indice_joueur_debout]);

                } else {
                    for (let i = 0; i < joueurs[partieLancee].length; i++) {
                        clients[joueurs[partieLancee][i]].emit("revelation", {
                            partieLancee: partieLancee,
                            joueur: joueurs[partieLancee][indice_joueur_debout],
                            mise: mise
                        });
                    }

                }
                return;
            }
        }else{
            prochainJoueur = choixJoueur(partieLancee, joueur);
            console.log("l'ia mise");
            for (let i = 0; i < joueurs[partieLancee].length; i++) {
                clients[joueurs[partieLancee][i]].emit("mise", {
                    partieLancee: partieLancee,
                    joueur: joueur,
                    prochainJoueur: prochainJoueur,
                    mise: 1
                });
            }
        }
        if(isIA(partieLancee,prochainJoueur)){
            iaMise(partieLancee,prochainJoueur,false,mise,miseFinale);
        }

    }

    /**
     * S'effectue quand l'IA doit révéler sa propre carte
     * Elle va demander à un joueur humain (encore sur la page du jeu) si la carte qu'elle a révélé de sa pile est un crâne ou non
     * @param partieLancee
     * @param joueur
     */

    function iaRevelation(partieLancee,joueur){
        let indiceIa = indiceIA(partieLancee,joueur);
        let carte = ias[partieLancee][indiceIa].cartesPile.shift();
        ias[partieLancee][indiceIa].cartesDefausse.push(carte);
        let demandeInfo = joueurs[partieLancee][0];
        let i=0;
        while(isIA(partieLancee,demandeInfo)){
            console.log("pour le crane ==> "+demandeInfo);
            demandeInfo = joueurs[partieLancee][i];
            i++;
        }
        let index = getIndiceJoueurTab(demandeInfo,partieLancee);
        let obj ={
            partieEnCours:partieLancee,
            carte:carte,
            joueur:joueur
        };

        clients[joueurs[partieLancee][index]].emit("carteCrane",obj);
        console.log("L'IA "+joueur+" revele une carte");
        console.log("obj");
        console.log(obj);
        for(let i=0;i< joueurs[partieLancee].length;i++){
            clients[joueurs[partieLancee][i]].emit("pileVersDefausse",{partieLancee:partieLancee, joueur:joueur, pileDeJoueur:joueur, carte:carte });
            clients[joueurs[partieLancee][i]].emit("revelation", {
                partieLancee: partieLancee,
                joueur: joueur,
                mise: 1
            });
        }


    }

    /**
     * Reçu quand un joueur quitte une partie
     * @param game Object Indice de partie, ses cartes, s'il doit miser, s'il doit jouer
     */

    socket.on("quitGame",function(game){
        if(currentID){
            console.log("Sortie de la partie "+game.partieEnCours+" par "+currentID);
            quitGame(null,game.partieEnCours,game.cartes,game.cartesPile,game.cartesDefausse,game.elimine,game.monTour,game.mise);
            console.log(joueurs);
            if(game.monTour && joueurs[game.partieEnCours]!==undefined && game.cartes===null){
                jouer(game.partieEnCours);
            }
        }
    });

    /**
     * S'effectue quand un joueur doit quitter la partie
     * S'il n'est pas éliminé et que la partie à commencer alors ce joueur deviendra une IA
     * S'il n'y plus aucun joueur humain ou qu'il ne reste plus de joueur on va alors supprimer la partie du serveur
     * S'il ne reste qu'un seul joueur humain il est alors considéré comme vainqueur de la partie et la partie
     * s'arrêtera après
     * @param joueur
     * @param game
     * @param cartes
     * @param cartesPile
     * @param cartesDefausse
     * @param elimine Eliminé?
     * @param mon_tour Son tour de jouer?
     * @param mise Son tour de mise?
     */

    function quitGame(joueur,game,cartes,cartesPile,cartesDefausse,elimine,mon_tour,mise){
        console.log("quitGame ==> "+game+" par "+joueur);
        if(joueur===null){
            joueur=currentID;
        }
        if(cartes!=null && !elimine && launched[game]) {
            let ia = {
                joueur: joueur,
                cartes: cartes,
                cartesPile:cartesPile,
                cartesDefausse : cartesDefausse
            };
            ias[game].push(ia);
            if(mon_tour && !mise && joueurs[game].length !== ias[game].length){
                iaJoue(game,joueur);
            }else if(mon_tour && mise && joueurs[game].length !== ias[game].length){
                iaMise(game,joueur,false,0);
            }

        }else{
            console.log("encule ton chien ==> "+game+" par "+joueur);
            let index_joueur = getIndiceJoueurTab(joueur,game);
            isCouche[game].splice(index_joueur,1);
            scores[game].splice(index_joueur,1);
            joueurs[game] = joueurs[game].filter(function(el){return el !==joueur });
        }

        console.log("nique toi ==> "+game+" par "+joueur);
        let victoireTotale=false;

        if(joueurs[game].length  ===1 && launched[game]){
            console.log("nique toi ==> "+game+" par "+joueur);
            console.log(joueurs);
            console.log("MAIS "+joueurs[game][0]);
            console.log(ias);
            victoireTotale=true;
            clients[joueurs[game][0]].emit("resetManche",
                {
                    joueur:joueurs[game][0],
                    partieLancee: game,
                    prochainJoueur: joueurs[game][0],
                    victoire:true,
                    victoireTotale:victoireTotale
                });
        }
        console.log("stp jpp ==> "+game+" par "+joueur);
        console.log(joueurs);
        console.log(ias);

        if(joueurs[game].length ===0 || joueurs[game].length === ias[game].length){
            io.sockets.emit("suppressionInvitation",game);
            delete joueurs[game];
            delete ias[game];
            delete scores[game];
            delete isCouche[game];
            delete launched[game];
            dispos.push(game);

            if(game===(partie-1)){
                partie--;
                if(partie===0){
                    partie=1;
                }
            }

        }else if(elimine || !launched[game] ||victoireTotale){
            let liste = {
                joueurs: joueurs[game],
                id_partie: game
            };
            let aurevoir ={
                joueur:joueur,
                id_partie:game
            };

            for(let i=0;i<joueurs[game].length;i++){

                clients[joueurs[game][i]].emit("listeGame",liste);
                clients[joueurs[game][i]].emit("joueurPart",aurevoir);
                clients[joueurs[game][i]].emit("message",{from:null, to:null, text: joueur + " a quitté la partie", date:Date.now(),id_partie:game});
            }
        }
    }

    // fermeture
    socket.on("logout", function() {
        // si client était identifié (devrait toujours être le cas)
        if (currentID) {
            console.log("Sortie de l'utilisateur " + currentID);
            // envoi de l'information de déconnexion
            socket.broadcast.emit("message",
                { from: null, to: null, text: currentID + " a quitté la discussion", date: Date.now(),id_partie:0 } );
                // suppression de l'entrée
            delete clients[currentID];
            // envoi de la nouvelle liste pour mise à jour
            socket.broadcast.emit("liste", Object.keys(clients));
        }
    });

    /**
     * Renvoie les numéros des parties dans lesquelles le joueur est dedans
     * @param joueur
     * @returns {[]} tableau avec les numéros de partie
     */

    function getPartiesJoueur(joueur){
        let games =[];
        for(let i=1;i<joueurs.length;i++){
            if(joueurs[i]!==undefined) {
                for (let j = 0; j < joueurs[i].length; j++) {
                    if (joueur === joueurs[i][j]) {
                        games.push(i);
                    }
                }
            }
        }
        return games;
    }

    // déconnexion de la socket
    socket.on("disconnect", function(reason) {
        // si client était identifié
        if (currentID) {
            console.log("current :"+currentID);
            console.log(" avant filtrage==> ");
            console.log(joueurs);
            let games = getPartiesJoueur(currentID);
            console.log("games de current : "+games);
            for(let i=0;i<games.length;i++) {
                quitGame(null,games[i],null,null,null,true,false,false);
            }
            console.log(" après filtrage==> "+joueurs);
            // envoi de l'information de déconnexion
            socket.broadcast.emit("message",
                { from: null, to: null, text: currentID + " vient de se déconnecter de l'application", date: Date.now(),id_partie:0 } );
                // suppression de l'entrée
            delete clients[currentID];
            // envoi de la nouvelle liste pour mise à jour
            socket.broadcast.emit("liste", Object.keys(clients));
        }
        console.log("Client déconnecté");
    });

});