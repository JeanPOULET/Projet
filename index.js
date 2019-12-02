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

    socket.on("invitation",function(invit){
        let partieF;
        let shifted=false;

        console.log(dispos);
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

    socket.on("carteARetirer",function(obj){
        let partieLancee = obj.partieEnCours;

        for(let i=0;i< joueurs[partieLancee].length;++i){
            clients[joueurs[partieLancee][i]].emit("carteRetiree",{partieLancee:partieLancee, joueur:obj.joueur, carte:obj.carte });
        }


    });

    socket.on("joueurElimine",function(obj){
        let partieLancee = obj.partieEnCours;
        for(let i=0;i< joueurs[partieLancee].length;++i){
            clients[joueurs[partieLancee][i]].emit("joueurElimine",{partieLancee:partieLancee, joueur:obj.joueur,elimine:obj.elimine });
        }

    });

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

    function choixJoueur(partie,joueurActuel){
        let indice=0;
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

    function existInJoueurs(partieEnCours, joueur){
        for(let i =0; i < joueurs[partieEnCours].length;i++){
            if(joueurs[partieEnCours][i]===joueur){
                return true;
            }
        }
        return false;
    }

    function getIndiceJoueurTab(nomJoueur, partieEnCours) {
        for (let i = 0; i < joueurs[partieEnCours].length; i++) {
            if (nomJoueur === joueurs[partieEnCours][i]) {
                return i;
            }
        }
    }

    function jouer(partieLancee){
        let rand = Math.floor(Math.random()*(joueurs[partieLancee].length-1));

        for(let i=0;i<joueurs[partieLancee].length;i++){
            clients[joueurs[partieLancee][i]].emit("debutManche",{num_partie:partieLancee, joueur:joueurs[partieLancee][rand]});
        }
    }

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
        console.log("reset_manche joueur : "+choixJoueur(partieEnCours,null));
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

    function indiceIA(partieLancee,joueur){
        for(let i=0;i<ias[partieLancee].length;i++){
            if(ias[partieLancee][i].joueur === joueur){
                return i;
            }
        }
        return -1;
    }

    function iaJoue(partieLancee,joueur){
        console.log("IA doit poser carte ");
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

    function IAdelete(partieLancee){
        while(ias[partieLancee].length>0){
            console.log("dans iaDELETE lg = "+ias[partieLancee].length);
            let joueur = ias[partieLancee].pop().joueur;
            let index_joueur = getIndiceJoueurTab(joueur,partieLancee);
            quitGame(joueur,partieLancee,null,null,null,true,false,false);
        }
    }

    function isIA(partieLancee, joueur){
        console.log("ias : "+ias);
        if(ias[partieLancee]!==undefined) {
            if (ias[partieLancee].length > 0) {
                return indiceIA(partieLancee, joueur) !== -1;
            }
        }
        return false;
    }

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
     *  Gestion des déconnexions et des parties qui sont quittées
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

        /*if( joueurs[game]!==undefined && cartes===null && ){
            jouer(game);
        }*/


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