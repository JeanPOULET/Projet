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
var partie=1; //indice de la partie qu'on peut crée

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
    });

    /**
     * Fonctions pour :
     *      inviter des personnes
     *      rejoindre une partie
     */

    socket.on("invitation",function(invit){
        if(invit===null){
            io.sockets.emit("invitation",{partie:partie,from:null});

        }else {
            let inv = {
                partie: partie,
                from: invit.from
            };
            console.log("Invitation envoyé par " + inv.from + " partie num = " + partie);
            socket.emit("invitation", inv);
            for (let i in invit.to) {
                clients[invit.to[i]].emit("invitation", inv);
            }
            partie++;
        }

    });

    socket.on("joinGame",function(invit){
        console.log("partie rejointe par"+invit.joiner);
        if(joueurs[invit.partie]=== undefined){
            joueurs[invit.partie]=[];
        }
        joueurs[invit.partie].push(invit.joiner);
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
        // si message privé, envoi seulement au destinataire
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
            if (msg.to != null && joueurs[msg.id_partie][msg.to] !== undefined) {
                console.log(" --> message privé partie n° "+msg.id_partie);
                clients[joueurs[msg.id_partie][msg.to]].emit("message", msg);
                if (msg.from !== msg.to) {
                    socket.emit("message", msg);
                }
            } else if(joueurs[msg.id_partie][msg.to] === undefined){
                console.log(" --> broadcast partie n° "+msg.id_partie);
                for(let i in joueurs[msg.id_partie]){
                    clients[joueurs[msg.id_partie][i]].emit("message", msg);
                }

            }
        }
    });

    /**
     * Gérer les parties
     *
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
        jouer(partieLancee,0);


    });

    socket.on("carteSelectionnee",function(obj) {
        let partieLancee = obj.partieEnCours;
        let prochainJoueur =choixJoueur(partieLancee,obj.joueur);

        for(let i in joueurs[partieLancee]){
            clients[joueurs[partieLancee][i]].emit("nouvelManche",{partieLancee:partieLancee,
                joueur:obj.joueur,
                prochainJoueur:prochainJoueur,
                carte:obj.carte });
        }

    });

    socket.on("carteSelectionneePile",function(obj) {
        let partieLancee = obj.partieEnCours;

        for(let i in joueurs[partieLancee]){

            clients[joueurs[partieLancee][i]].emit("pileVersDefausse",{partieLancee:partieLancee, joueur:obj.joueur, pileDeJoueur:obj.pileDeJoueur, carte:obj.carte });

            if(obj.gagne){
                victoire(partieLancee,obj.joueur,obj.points);
            }

            if(obj.perdu){
                defaite(partieLancee,obj.joueur,obj.pileDeJoueur);
            }

        }



    });

    function defaite(partieEnCours, joueur, doitEnleverCarte){
        console.log("reset_manche joueur : "+choixJoueur(partieEnCours,joueur));
        for(let i=0; i<joueurs[partieEnCours].length;i++){
            clients[joueurs[partieEnCours][i]].emit("perdManche",
                {perdant:joueur,
                    partieLancee:partieEnCours,
                    doitEnleverCarte:doitEnleverCarte});
            clients[joueurs[partieEnCours][i]].emit("resetManche",
                {partieLancee:partieEnCours,
                    joueur:joueur,
                    victoire:false,
                    prochainJoueur:doitEnleverCarte});
        }


    }
    function victoire(partieEnCours,joueur,points){
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
                    prochainJoueur: choixJoueur(partieEnCours, joueur),
                    victoire:true
                });
        }
    }

    socket.on("mise",function(mise){
        let partieLancee = mise.partieEnCours;
        let prochainJoueur="";
        if(mise.miseFinale){
            prochainJoueur = mise.joueur;
        }else {
            prochainJoueur = choixJoueur(partieLancee, mise.joueur);
        }
        for(let i in joueurs[partieLancee]){

            clients[joueurs[partieLancee][i]].emit("mise",{partieLancee:partieLancee, joueur:mise.joueur, prochainJoueur:prochainJoueur, mise:mise.mise});
            if(mise.miseFinale) {
                clients[joueurs[partieLancee][i]].emit("revelation", {
                    partieLancee: partieLancee,
                    joueur: mise.joueur,
                    mise: mise.mise
                });
            }
            }
    });


    function choixJoueur(partie,joueurActuel){

        for(let j=0;j<joueurs[partie].length;j++){
            if(joueurs[partie][j] === joueurActuel){
                j++;
                if(j===joueurs[partie].length){
                    j=0;
                }
                return joueurs[partie][j];
            }
        }
    }


    function jouer(partieLancee, etat){

        switch(etat){
            case 0 :
                let rand = Math.floor(Math.random()*(joueurs[partieLancee].length-1));
                console.log("rand : "+rand);

                for(let i in joueurs[partieLancee]){
                    clients[joueurs[partieLancee][i]].emit("debutManche",{num_partie:partieLancee, joueur:joueurs[partieLancee][rand]});
                 }
                 break;
            case 1 :

            case 2 :
            case 3 :
            case 4 :
            case 5 :
        }


    }


    /**
     *  Gestion des déconnexions
     */

    socket.on("quitGame",function(game){
        if(currentID){
            console.log("Sortie de la partie "+game+" par "+currentID);
            quitGame(game);
            console.log(joueurs);
        }
    });

    function quitGame(game){
        joueurs[game] = joueurs[game].filter(function(el){return el !==currentID });
        console.log(joueurs);
        if(joueurs[game].length ===0){
            io.sockets.emit("suppressionPartie",game);
            delete joueurs[game];
            partie--;
            if(partie===0){
                partie=1;
            }
            io.sockets.emit("invitation",{partie:partie,from:null});

        }else {
            let liste = {
                joueurs: joueurs[game],
                id_partie: game
            };
            for(let i in joueurs[game]){
                clients[joueurs[game][i]].emit("listeGame",liste);
                clients[joueurs[game][i]].emit("message",{from:null, to:null, text: currentID + " a quitté la partie", date:Date.now(),id_partie:game});
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

    // déconnexion de la socket
    socket.on("disconnect", function(reason) {
        // si client était identifié
        if (currentID) {
            console.log("current :"+currentID);
            console.log(" avant filtrage==> "+joueurs);
            for(let i in joueurs) {
                quitGame(i);
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