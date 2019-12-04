document.addEventListener("DOMContentLoaded", function(_e) {

    /*** Liste des "bugs" trouvés ***
     * 
    */

    /*** ToDo
     *
     */

    /*** ToFerBO
     * 
     */

     /*** ToComment
      * 
      */

    document.getElementById("radio-1").checked = true;
    document.getElementById("listePartie").style.display = "none";
    document.getElementById("histoPartie").style.display = "none";
    
                            /****************************************************
                             *                     VARIABLES                    *
                             ****************************************************/

    // socket ouverte vers le client
    var sock = io.connect();

    // utilisateur courant
    var currentUser = null;

    //liste des users
    var users = null;

    //liste des joueurs
    var players = [[]];
    var liste_joueurs =[[]];

    //indice de partie du serveur
    var partieInvite =-1;

    //représente celui qui a invité l'user courant
    var fromInvit=currentUser;

    //host
    var host = null;

    //nombre de partie du joueur (pour invitation)
    var nbPartie = 0;

    //tableau dans lequel le joueur fait partie
    var tabPartie=null;

    //tableau pour savoir dans chaque partie si c'est au tour du currentUser
    var mon_tour=null;

    //tableau pour savoir dans chaque partie si la mise générale est créée
    var miseAutorise = null;

    //tableau pour avoir dans chaque partie l'indice pour le sélecteur sur la main du joueur
    var indices = null;

    //nombre de cartes choisis lors de la selection des cartes dans les piles
    var nbCartesChoisis =null;

    //nombre maximum actuel de cartes dans les piles
    var maxNbPile=null;

    var partiesInvites =[];

    var partieAquitter=-1;

    //var mute on off
    var mute = 0;

                            /****************************************************
                             *                      SOCKETS                     *
                             ****************************************************/

    // on attache les événements que si le client est connecté.
    sock.on("bienvenue", function (id) {
        if (currentUser) {
            document.querySelector("#content main").innerHTML = "";
            document.getElementById("monMessage").value = "";
            document.getElementById("login").innerHTML = id;
            document.getElementById("radio0").checked = true;
            actualiserHistorique();
            document.getElementById("listePartie").style.display = "block";
            document.getElementById("histoPartie").style.display = "block";
            
            currentUser = id;
            fromInvit = currentUser;
            //localStorage.clear();
        }
    });

    /**
    * Reçoit un évènement socket "message" provenant du serveur
    * @param msg obj le texte, celui qui a envoyé le msg et enventuellement le destinataire (si msg privé)
     */
    sock.on("message", function (msg) {
        if (currentUser) {
            afficherMessage(msg);
        }
    });

    /**
     * Permet d'actualiser la liste des personnes présentes sur le chat générale
     * @param liste Array Tableau des personnes connectées au serveur
     */
    sock.on("liste", function (liste) {
        users = liste;
        if (currentUser) {
            afficherListe(liste, 0);
        }
    });

    /**
     * Permet d'actualiser la liste des personnes présentes sur une partie donnée
     * @param liste Object Tableau des joueurs sur une partie donnée
     */
    sock.on("listeGame", function (liste) {
        if(liste_joueurs[liste.id_partie] === undefined){
            liste_joueurs[liste.id_partie] =[];
        }
        liste_joueurs[liste.id_partie] = liste.joueurs;
        console.log("liste joueurs : "+liste_joueurs);
        if (currentUser) {
            afficherListe(liste.joueurs, liste.id_partie);

        }
    });

    /**
     * Evènement permettant d'actualiser l'indice pour savoir quelle indice notre partie aura une fois crée
     * de plus elle permet de donner le nom de l'hôte de la partie s'il y a eu réellement une invitation
     * @param invit Object Indice de partie, l'hôte (null si aucun)
     */
    sock.on("invitation", function (invit) {
        if (currentUser) {
            console.log("invitationneur : ",  (invit.from==null)?"serveurActualisé":invit.from);
            console.log("partieInvite actualisé : "+invit.partie);
            partieInvite = invit.partie;
            fromInvit = currentUser;
            if (invit.from != null) {
                fromInvit = invit.from;
            }
        }
    });

    /**
     * Permet de supprimer le lien d'invitation pour une partie donnée
     * @param num_partie Indice de partie
     */
    sock.on("suppressionInvitation", function (num_partie) {
        console.log("je dois delete la partie pour les invitations : "+num_partie);
        removeIDpartie(num_partie);
    });

    /**
     * Permet d'initialiser une partie donnée en afficher le plateau de jeu (le serveur donne aussi les cartes avec les cranes)
     * @param initialisation Object Indice de partie + les cranes
     */
    sock.on("iniPartie",function(initialisation){
        console.log("La partie est lancée n°"+initialisation.partieLancee);
        afficherPlateau(initialisation.partieLancee, initialisation.cranes);
        creationTableauScore(liste_joueurs[initialisation.partieLancee], initialisation.partieLancee);
    });

    /**
     * Utile pour la 1èr manche de la partie
     * @param manche Object Le prochain joueur, indice de partie
     */
    sock.on("debutManche",function(manche){
        document.getElementById("message"+manche.num_partie).innerHTML ="C'est à "+manche.joueur+" de jouer !";
        actualiserTabTour(manche.num_partie,manche.joueur);

    });

    /**
     * Evènement reçu quand un joueur à poser une carte de sa main dans sa pile
     * Appelle la fonction actualiserPile pour actualiser graphiquement (pour tout le monde) la pile du joueur concerné
     * @param nouvel_manche Object Indice de partie, joueur qui a posé une carte, prochain joueur
     */
    sock.on("nouvelManche",function(nouvel_manche){
        if(tabPartie.indexOf(nouvel_manche.partieLancee) >=0){
            document.getElementById("message" + nouvel_manche.partieLancee).innerHTML = "C'est à " + nouvel_manche.prochainJoueur + " de jouer !";
            actualiserTabTour(nouvel_manche.partieLancee, nouvel_manche.prochainJoueur);
            actualiserPile(nouvel_manche.partieLancee, nouvel_manche.joueur, nouvel_manche.carte);
        }

    });

    /**
     * Evènement reçu quand un joueur à miser
     * On va donc désactiver le listener de la main du joueur courant et actualiser la mise maximum de la manche
     * @param mise Object Indice de partie, joueur qui a misé, prochain joueur, mise du joueur précédent
     */
    sock.on("mise",function(mise){
        if(tabPartie.indexOf(mise.partieLancee) >=0) {
            document.getElementById("message" + mise.partieLancee).innerHTML = "C'est à " + mise.prochainJoueur + " de miser !";
            miseAutorise[mise.partieLancee] = true;
            actualiserTabTour(mise.partieLancee, mise.prochainJoueur);
            updateMiseGenerale(mise.partieLancee, mise.mise);
            disableListenerMain(mise.partieLancee);
        }

    });

    /**
     * Evènement reçu quand un joueur se couche
     * @param couche Object Indice de partie, joueur qui s'est couché, joueur suivant
     */
    sock.on("joueurSeCouche",function(couche){
        if(tabPartie.indexOf(couche.partieLancee) >=0) {
            document.getElementById("message" + couche.partieLancee).innerHTML = couche.joueur + " se couche. " + messageDAmourNegatif() + " C'est à " + couche.prochainJoueur + " de jouer !";
            actualiserTabTour(couche.partieLancee, couche.prochainJoueur);
        }
    });

    /**
     * Reçu quand un joueur retourne des cartes des piles
     * On va alors actualiser pour tout le monde la défausse et la pile du joueur affecté
     * @param pile Object Indice de partie, pile affectée, carte affectée
     */
    sock.on("pileVersDefausse",function(pile){
        if(tabPartie.indexOf(pile.partieLancee) >=0) {
            actualiserDefausse(pile.partieLancee, pile.pileDeJoueur, pile.carte);
        }
    });

    /**
     * Reçu quand un joueur gagne une manche
     * On va alors actualiser le tableau des scores
     * @param victoire Object Indice de partie, vainqueur de la manche, nb de points du vainqueur
     */
    sock.on("gagneManche",function(victoire){
        if(tabPartie.indexOf(victoire.partieLancee) >=0) {
            actualiserTableau(victoire.partieLancee, victoire.vainqueur, victoire.points);
        }
    });

    /**
     * Reçu quand le serveur s'occupe des IA
     * Le serveur demande si la carte que l'IA a retiré est un crâne ou non
     * @param obj Object Indice de partie, nom de joueur de l'IA
     */
    sock.on("carteCrane",function(obj){
       let crane = document.getElementById(obj.carte).classList.contains("crane");
       console.log("Crane? : "+crane );
       let ob ={
           isCrane : crane,
           partieEnCours:obj.partieEnCours,
           joueur:obj.joueur
        };
       sock.emit("carteCrane",ob);

    });

    /**
     * Reçu quand un joueur perd une manche
     * Celui qui avait posé un crâne va alors pouvoir retirer la carte du perdant qui l'a piochée
     * Si le perdant est celui qui a posé la carte alors on va retirer une carte de manière aléatoire
     * Le joueur qui a retiré la carte est alors le prochain joueur pour poser une carte cette fois ci
     * @param defaite Object Indice de partie, le perdant, celui qui retire la carte,
     */
    sock.on("perdManche",function(defaite){

        if(defaite.IA){
            return;
        }

        if(defaite.doitEnleverCarte === currentUser && defaite.perdant !==currentUser) {
            mon_tour[defaite.partieLancee]=false;
            retirerCarte(defaite.partieLancee,defaite.perdant);
        }else if ((defaite.perdant === defaite.doitEnleverCarte && defaite.perdant===currentUser)  ||defaite.doitEnleverCarte===null){
            mon_tour[defaite.partieLancee]=false;
            retirerCarteRandom(defaite.partieLancee);

        }

    });

    /**
     * Reçu quand un joueur part de la partie
     * On va alors le supprimmer graphiquement du plateau
     * @param aurevoir Object Indice de partie, joueur qui part
     */
    sock.on("joueurPart",function(aurevoir){
        deleteJoueur(aurevoir.joueur,aurevoir.id_partie);
    });

    /**
     *  Reçu quand la une manche se termine
     *  La manche peut être gagné (même la partie) ou perdu par un joueur
     * @param reset Object Indice de la partie, victoireFinale?, prochain joueur, joueur qui a perdu/gagné la manche
     */
    sock.on("resetManche",function(reset){
        let msg=reset.joueur;
        if(reset.victoire && !reset.victoireTotale){
            msg +=" a gagné la manche ! "+messageDAmourPositif();
        }else if(!reset.victoire && !reset.victoireTotale){
            msg +=" a perdu la manche ! "+messageDAmourNegatif()+" "+reset.prochainJoueur+ " doit enlever une carte à ce nullos ! ";
        }else{
            msg +=" a gagné la partie ! " + messageDAmourPositif();
            let savePseudo = reset.joueur;
            let date= Date().toString();
            localStorage.setItem(savePseudo, date);
        }
        if(!reset.victoireTotale) {
            document.getElementById("message" + reset.partieLancee).innerHTML = msg + "  C'est à " + reset.prochainJoueur + " de jouer !";
            textToSpeack(msg + "  C'est à " + reset.prochainJoueur + " de jouer !", reset.partieLancee);
        }else{
            if(tabPartie.indexOf(reset.partieLancee)!==-1) {
                document.getElementById("message" + reset.partieLancee).innerHTML = msg + " Fin de la partie dans 3 secondes ! Tchao les nazes";
                textToSpeack("Fin de la partie dans 5 secondes ! Tchao les nazes", reset.partieLancee);
            }
        }
        nbCartesChoisis[reset.partieLancee]=0;

        if(!reset.victoireTotale) {
            document.getElementById("miseGenerale"+reset.partieLancee).innerHTML ="Mise actuelle : 0";
            disableListenerMain(reset.partieLancee);
            disableListenerPile(reset.partieLancee);
            resetAffichage(reset.partieLancee);
            enableListenerMain(reset.partieLancee);
            actualiserTabTour(reset.partieLancee, reset.prochainJoueur);
        }else{
            partieAquitter=reset.partieLancee;
            setTimeout(quitterGame,5000);
        }


    });

    /**
     * Reçu quand un joueur doit révéler les cartes des piles
     * Si le joueur courant est celui qui doit révéler les cartes alors il peut choisir les cartes qu'il veut piocher
     * @param revel Object Indice de partie, joueur qui révèle les cartes
     */
    sock.on("revelation",function(revel){
        if(tabPartie.indexOf(revel.partieLancee) >=0) {
            document.getElementById("message" + revel.partieLancee).innerHTML = revel.joueur + " tire les cartes !";
            textToSpeack(revel.joueur + " tire les cartes !", revel.partieLancee);
            miseAutorise[revel.partieLancee] = false;
            if (revel.joueur === currentUser) {
                document.getElementById("btnMiser" + revel.partieLancee).disabled = true;
                document.getElementById("btnCoucher" + revel.partieLancee).disabled = true;
                addPileListener(revel.partieLancee);
            }
        }

    });

    /**
     * Reçu quand une carte doit être retirer du plateau (c'est à dire quand un joueur qui a perdu s'est fait prendre une de ses cartes)
     * @param obj Object Indice de partie, joueur à qui la carte doit partir, carte qui doit partir
     */
    sock.on("carteRetiree",function(obj){
       retirerCartePlateau(obj.partieLancee,obj.joueur,obj.carte);

    });

    /**
     * Reçu quand un joueur se fait éliminer (c'est à dire quand il n'a plus de carte)
     * @param obj Object Indice de partie, joueur eliminé,
     */
    sock.on("joueurElimine",function(obj){
        document.getElementById("message"+obj.partieLancee).innerHTML =obj.joueur+" est eliminé !\n AHAHAH ! noobi ! Allez dégage !";
        textToSpeack(obj.joueur+" est eliminé !\n AHAHAH ! noobi ! Allez dégage !", obj.partieLancee);
        if(obj.joueur===currentUser){
            quitterGame(obj.partieLancee,obj.elimine);
        }
    });

                            /****************************************************
                             *              FONCTIONS DIVERSIFIERS              *
                             ****************************************************/

    /** 
     * Mise en place d'une liste déroulante permettant à l'utilisateur de séléctionner la langue du synthétiseur
     * vocal, ainsi que 2 boutons permettant de régler le volume et la vitesse de parole.
     * --> Inutil sous Firefox qui n'accepte que l'anglais
     */ 
    /*********************************************************
     var synth = window.speechSynthesis;
     var voices = []

     function appel(text){
    var msg = new SpeechSynthesisUtterance();
    msg.voice = voices[document.querySelector('#voices').value];
    msg.rate = 5/10;
    msg.pitch = 100;
    msg.text = text;

    synth.speak(msg);
}
     function PARLE(){
        if(typeof speechSynthesis === 'undefined') {
            return;
        }
        var selectedVoice = document.querySelector("#voices");
        voices = speechSynthesis.getVoices().sort(function (a, b) {
            const aname = a.name.toUpperCase(), bname = b.name.toUpperCase();
            if ( aname < bname ) return -1;
            else if ( aname == bname ) return 0;
            else return +1;
        });
        var selectedIndex = selectedVoice.selectedIndex < 0 ? 0 : selectedVoice.selectedIndex;
        selectedVoice.innerHTML = '';
        for(i = 0; i < voices.length ; i++) {
            var option = document.createElement('option');
            option.textContent = voices[i].name + ' (' + voices[i].lang + ')';

            if(voices[i].default) {
                option.textContent += ' -- DEFAULT';
            }

            option.setAttribute('data-lang', voices[i].lang);
            option.setAttribute('data-name', voices[i].name);
            selectedVoice.appendChild(option);
        }
        selectedVoice.selectedIndex = selectedIndex;
    }
     PARLE();
     if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = PARLE;
    }

     ******************************************* */
    
    /**
     * Permet d'actualiser l'historique présent sur le chat principal à chaque nouvel accès à celui-ci
     */
     function actualiserHistorique(){
        document.querySelector("#histoPartie ul").innerHTML = "";
        for(let i = 0; i < localStorage.length; ++i){
            var playerName = localStorage.key(i);
            var date = localStorage.getItem(playerName);
            console.log("pseudo : "+playerName);
            var li = document.createElement("li");
            li.innerHTML = "Victoire de : "+playerName+" le "+date;
            document.querySelector("#histoPartie ul").appendChild(li);
        }
    }

    /**
     * Permet de faire lire un texte au synthétiseur vocal si le bouton mute n'est pas activé
     */
    function textToSpeack(text, partie){
        let synth = window.speechSynthesis;

        if(mute == 0){
            let utterThis = new SpeechSynthesisUtterance(text);
            utterThis.lang = 'fr';
            synth.speak(utterThis);
        }else{
            synth.cancel();
        }
    }

    /**
     * Choisi aléatoirement quel message d'amour dire à un joueur qui est nul
     */
    function messageDAmourNegatif(){
        let rand = Math.floor(Math.random() * 7);
        let message;
        switch(rand){
            case 0:
                message = "Minable ...";
            break;
            case 1:
                message = "Nul ! Nul ! Nul !";
            break;
            case 2:
                message = "Mais c'était sûr en fait !";
            break;
            case 3:
                message = "Pitoyable...";
            break;
            case 4:
                message = "Tu le fais exprès ?";
            break;
            case 5:
                message = "Ma grand-mère joue mieux que ça !";
            break;
            case 6:
                message = "Vraiment ? Contre eux ?";
            break;
        }
        return message;
    }
    
    /**
     * Choisi un message aléatoire à écrire quand le joueur fait une bonne action
     */
    function messageDAmourPositif(){
        let rand = Math.floor(Math.random() * 5);
        let message;
        switch(rand){
            case 0:
                message = "Mouais, pas mal.";
            break;
            case 1:
                message = "C'est un début.";
            break;
            case 2:
                message = "Enfin !";
            break;
            case 3:
                message = "C'est bien, tu veux un cookie ?";
            break;
            case 4:
                message = "Wow si fort !";
            break;           
        }
        return message
    }

                            /****************************************************
                             *                 FONCTIONS CHATS                  *
                             ****************************************************/

    /**
     *  Connexion de l'utilisateur au chat.
     */
    function connect() {

        // recupération du pseudo
        let reg = new RegExp(/^[a-zA-Z0-9-\s]+$/g);
        if(reg.test(pseudo.value)){
            let user = document.getElementById("pseudo").value.trim();
            if (!user) return;
            document.getElementById("radio0").checked = true;
            currentUser = user;
            sock.emit("login", user);
        }else{
            alert("Votre pseudo doit contenir : \n\t - Des lettres majuscules ou miniscules \n\t - Des chiffres \n\t - Aucun caractère spécial (accent compris) \n\t - Entre 3 et 16 caractères")
        }
    }   

    /**
     *  Affichage des messages
     */
    function afficherMessage(data) {

        if (!currentUser) {
            return;
        }

        // affichage des nouveaux messages
        let bcMessages;
        if (data.id_partie === 0) {
            bcMessages = document.querySelector("#content main");
        } else if(tabPartie.indexOf(data.id_partie)!==-1) {
            bcMessages = document.querySelector("#contentGame" + data.id_partie + " main");
        }else{
            return;
        }

        let classe = "";

        if (data.from === currentUser) {
            classe = "moi";
        } else if (data.from == null) {
            classe = "system";
        }

        if (data.to != null) {
            classe = classe || "mp";
            data.from += " (à " + data.to + ")";
        }

        let date = new Date(data.date);
        date = date.toISOString().substr(11, 8);
        if (data.from == null) {
            data.from = "[admin]";
        }

        data.text = traiterTexte(data.text);

        bcMessages.innerHTML += "<p class='" + classe + "'>" + date + " - " + data.from + " : " + data.text + "</p>";
        if (data.id_partie === 0) {
            document.querySelector("main > p:last-child").scrollIntoView();
        } else if(tabPartie.indexOf(data.id_partie)!==-1){
            document.querySelector("#contentGame" + data.id_partie + " main > p:last-child").scrollIntoView();
        }

        if(fromInvit===currentUser && data.id_partie===0 ){
            removeIDpartie(partieInvite);
        }
        if (data.id_partie === 0 && fromInvit !== currentUser) {
            alert("Vous êtes invité par "+fromInvit+" pour la partie n°"+partieInvite+" !");
            partiesInvites.push(partieInvite);
            listenerInvitation();
            fromInvit=currentUser;
        }

    }

    /**
     * Ajoute un listener sur le lien permettant l'invitation dans une partie et lui donne la classe lienActif 
     * permettant le surlignage tant qu'il n'a pas été utilisé
     */
    function listenerInvitation(){
        for(let i=0;i<partiesInvites.length;i++){
            document.getElementById("p_" + partiesInvites[i]).addEventListener("click", rejoindrePartie);
            document.getElementById("p_" + partiesInvites[i]).classList.add("lienActif");
        }
    }

    /**
     * Traitement des emojis
     */
    function traiterTexte(txt) {
        let ind = txt.indexOf("[img:");
        while (ind >= 0) {
            console.log(txt);
            txt = txt.replace("\[img:", '<img src="');
            txt = txt.replace('\]', '">');
            ind = txt.indexOf("[img:");
        }
        txt = txt.replace(/:[-]?\)/g, '<span class="emoji sourire"></span>');
        txt = txt.replace(/:[-]?D/g, '<span class="emoji banane"></span>');
        txt = txt.replace(/:[-]?[oO]/g, '<span class="emoji grrr"></span>');
        txt = txt.replace(/<3/g, '<span class="emoji love"></span>');
        txt = txt.replace(/:[-]?[Ss]/g, '<span class="emoji malade"></span>');
        return txt;
    }

    /**
     * Affiche les listes de joueur dans les différents chat
     */
    function afficherListe(newList, game) {
        if (game === 0) {
            document.querySelector("#content aside").innerHTML = newList.join("<br>");
        } else if(tabPartie.indexOf(game) !==-1  ) {
            document.querySelector("#contentGame" + game + " aside").innerHTML = newList.join("<br>");
        }
    }

    /**
     *  Envoyer un message
     */
    function envoyer() {

        let msg = document.getElementById("monMessage").value.trim();
        if (!msg) return;

        // message privé
        let to = null;
        if (msg.startsWith("@")) {
            let i = msg.indexOf(" ");
            to = msg.substring(1, i);
            msg = msg.substring(i);
        }
        // envoi
        sock.emit("message", {from: currentUser, to: to, text: msg, id_partie: 0});

        document.getElementById("monMessage").value = "";
    }

    /**
     * Envoie un message
     */
    function envoyerMsgGame() {
        let id_btn = this.id;
        let reg = new RegExp(/[^\d]/g);
        let nb = id_btn;
        nb = nb.replace(reg, "");
        const res = parseInt(nb, 10);

        let msg = document.getElementById("monMessage_p_" + res).value.trim();
        if (!msg) return;

        // message privé
        let to = null;
        if (msg.startsWith("@")) {
            let i = msg.indexOf(" ");
            to = msg.substring(1, i);
            msg = msg.substring(i);
        }
        console.log("to game : "+to);
        console.log("id_partie to Game"+ res);
        // envoi
        sock.emit("message", {from: currentUser, to: to, text: msg, id_partie: res});

        document.getElementById("monMessage_p_" + res).value = "";
    }

    /**
     *  Fermer la zone de choix d'une image
     */
    function toggleImage(evt, id = -1) {

        let final_id = getIdString(this.id);

        if (id > 0) {
            final_id = id;
        }
        if (document.getElementById("bcImage" + final_id).style.display === "none") {
            document.getElementById("bcImage" + final_id).style.display = "block";
            document.getElementById("recherche" + final_id).focus();
        } else {
            document.getElementById("bcImage" + final_id).style.display = "none";
            document.getElementById("recherche" + final_id).value = "";
            document.getElementById("bcResults" + final_id).innerHTML = "";
        }
    }

    /**
     *  Recherche d'une image
     */
    function rechercher() {
        let final_id = getIdString(this.id);
        var queryString = document.getElementById("recherche" + final_id).value;
        queryString = queryString.replace(/\s/g, '+');
        // appel AJAX
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function (_e) {
            if (this.readyState === XMLHttpRequest.DONE) {
                if (this.status === 200) {
                    var data = JSON.parse(this.responseText).data;
                    console.log(data);
                    var html = "";
                    for (let i in data) {
                        let url = data[i].images.fixed_height.url;
                        html += "<img src='" + url + "'>";
                    }
                    document.getElementById("bcResults" + final_id).innerHTML = html;
                }
            }
        };
        xhttp.open('GET', 'http://api.giphy.com/v1/gifs/search?q=' + queryString + '&limit=10&api_key=0X5obvHJHTxBVi92jfblPqrFbwtf1xig', true);
        xhttp.send(null);
    }

    /**
     * Envoie d'une image sous format [img:url]
     */
    function choixImage(e) {
        let id = getIdInt(this.id);
        console.log("choixImg : ", id);
        if (e.target instanceof HTMLImageElement) {
            sock.emit("message", {from: currentUser, to: null, text: "[img:" + e.target.src + "]", id_partie: id});
            toggleImage(id, id);
        }

    }

                            /****************************************************
                             *                FONCTIONS DIVERSES                *
                             ****************************************************/

    /**
     * Renvoie en chaine le numéro d'id d'un résultat d'évenèment
     */ 
    function getIdString(id) {
        if (id === undefined || id == null) {
            return "";
        }
        let reg = new RegExp(/[^\d]/g);
        id = id.replace(reg, "");
        const val = parseInt(id, 10);
        console.log(val);
        let final_id = "";
        if (val > 0) {
            final_id = val;
        }
        return final_id;
    }

    /**
     * Renvoie en entier le numéro d'id d'un résultat d'évenèment
     * @param id
     * @returns {number}
     */

    function getIdInt(id) {
        if (id === undefined || id == null) {
            return 0;
        }
        let reg = new RegExp(/[^\d]/g);
        id = id.replace(reg, "");
        return parseInt(id, 10);
    }

    /**
     * Utilisé quand on a un id avec plusieurs chiffres dedans et qu'on souhaite retirer le second
     * @param id
     * @returns {number}
     */

    function getIdDoubleInt(id) {
        if (id === undefined || id == null) {
            return 0;
        }
        let nb_chiffres =0;
        let res =0;
        for(let i=0;i<id.length;i++){
            if(id[i].match(/\d/)){
                if(nb_chiffres===1){
                   res= parseInt(id[i]);
                }
            }

            if(id[i].match(/\d/)){
                nb_chiffres++;
            }
        }

        return res;
    }

    /**
     * Actualise le tableau de tour (pour savoir si c'est au tour du joueur courant)
     * Si c'est son tour alors il pourra jouer ou miser
     * @param num_partie
     * @param joueur
     */

    function actualiserTabTour(num_partie, joueur){
        if(miseAutorise ==null){
            miseAutorise=[];
        }
        if(miseAutorise[num_partie]===undefined){
            miseAutorise[num_partie]=false;
        }

        if(mon_tour == null){
            mon_tour=[];
        }
        if(mon_tour[num_partie] ===undefined){
            mon_tour[num_partie] = false;
        }
        if(joueur === currentUser){
            mon_tour[num_partie] = true;
            document.getElementById("btnMiser"+num_partie).removeAttribute("disabled");
            if(miseAutorise[num_partie]) {
                document.getElementById("btnCoucher" + num_partie).removeAttribute("disabled");
            }

        }else{
            mon_tour[num_partie] = false;
            document.getElementById("btnMiser"+num_partie).disabled=true;
            document.getElementById("btnCoucher" + num_partie).disabled = true;

            }
        console.log("mon_tour : "+mon_tour);
    }

    /**
     * Initialise tous les tableaux nécessaire au déroulement des parties
     */
    function iniTabs(num_partie) {
        if(tabPartie===null){
            tabPartie=[];
        }
        if(indices == null){
            indices = [];
        }
        if(miseAutorise ==null){
            miseAutorise=[];
        }
        if(mon_tour ==null){
            mon_tour=[];
        }
        if(nbCartesChoisis ==null){
            nbCartesChoisis=[];
        }

        if(liste_joueurs[num_partie]===undefined){
            liste_joueurs[num_partie]=[];
        }

        if(nbCartesChoisis[num_partie]===undefined){
            nbCartesChoisis[num_partie]=0;
        }

        if(miseAutorise[num_partie]===undefined){
            miseAutorise[num_partie]=false;
        }
        if(mon_tour[num_partie]===undefined){
            mon_tour[num_partie]=false;
        }

    }

                            /****************************************************
                             *                      GETTEURS                    *
                             ****************************************************/

    /**
     * Récupère les IDs des cartes de la main d'un joueur dans une partie
     */
    function getIDsCartesMain(num_partie){
        let cartes=[];
        let main = document.querySelector("#gameMain_p_"+num_partie+" #"+currentUser+"_"+num_partie+" main");
        if(main ===null){
            return null;
        }

        if(main.childElementCount===0){
            return null;
        }
        for(let i=0;i<main.childElementCount;i++){
            cartes[i]=main.children[i].id;
        }

        return cartes;
    }

    /**
     * Récupère les IDs des cartes d'une pile d'un joueur dans une partie
     */
    function getIDsCartesPile(num_partie){
        let cartes=[];
        let pile = document.querySelector("#gameMain_p_"+num_partie+" #"+currentUser+"_"+num_partie+" #pile_"+currentUser+"_"+num_partie);
        if(pile ===null){
            return cartes;
        }

        if(pile.childElementCount===0){
            return cartes;
        }
        for(let i=0;i<pile.childElementCount;i++){
            cartes[i]=pile.children[i].id;
        }

        return cartes;
    }

    /**
     * Récupère les IDs des cartes de la défausse dans une partie
     */
    function getIDsCartesDefausse(num_partie){
        let cartes=[];
        let defausse = document.querySelector("#gameMain_p_"+num_partie+" #defausse"+num_partie);
        if(defausse ===null){
            return cartes;
        }

        if(defausse.childElementCount===0){
            return cartes;
        }
        for(let i=0;i<defausse.childElementCount;i++){
            if(getPseudo(defausse.children[i].id) === currentUser){
                cartes[i]=defausse.children[i].id;
            }
        }

        return cartes;
    }

    /**
     * Renvoie le nombre de carte présente sur le plateau
     */
    function getNombreCartesPlateau(partieEnCours){
        let nb_joueurs = liste_joueurs[partieEnCours].length;
        let nb_cartes =0;
        for(let i=0;i<nb_joueurs;i++){
            nb_cartes += document.getElementById("pile_"+liste_joueurs[partieEnCours][i]+"_"+partieEnCours).childElementCount;
        }
        return nb_cartes;
    }

    /**
     * Renvoie le pseudo à partir d'un id donc sans _
     */
    function getPseudo(id){
        let tabz = id.split("_");
        return tabz[2];
    }

    /**
     * Renvoie le nombre de carte présent dans la pile d'un joueur
     */
    function getNombreCartesPile(id, pseudo){
        return document.getElementById("pile_"+pseudo+"_"+id).childElementCount;
    }

    /**
     * Renvoie la mise générale actuelle pour une partie
     */
    function getMiseGenerale(partieEnCours){
        let miseActuel;
        let miseActuelhtml = document.getElementById("miseGenerale"+partieEnCours).innerHTML;
        miseActuel = getIdInt(miseActuelhtml);
        return miseActuel;
    }

    /**
     * Retourne le nombre de carte dans la main du joueur courant
     */
    function getNombreCarteMain(partieEnCours){
        return document.querySelector("#"+currentUser+"_"+partieEnCours+" main").childElementCount;
    }
    
                            /****************************************************
                             *              FONCTIONS INVITATIONS               *
                             ****************************************************/

    /**
     * Permet de séléctionné les membres que l'on veut inviter dans une partie
     */
    function fenetreInvitation() {
        var metoru = 0;
        document.querySelector('#invitations').innerHTML = "";
        var invites = users;
        if(metoru === 0){
            document.getElementById("btnInviter").disabled = true;
        }
        for (let i in invites) {
            let id = invites[i];
            if (id !== currentUser) {
                let btn = document.createElement("div");

                // Créer une checkbox pour chaque joueur afin d'afficher son pseudo et de pouvoir le sélectionner
                btn.innerHTML = "<input type='checkbox' class=\"inputStyle\" name=\"" + id + "\" id=" + id + "><label class=\"effetSurli labelStyle\" id=\"label" + id + "\" for=" + id + ">" + id + "</label>";
                document.querySelector('#invitations').appendChild(btn);
                document.getElementById(id).addEventListener("click", function () {
                    if (document.getElementById(id).hasAttribute("checked")) {
                        metoru--;
                        if(metoru <=1 ){
                            document.getElementById("btnInviter").disabled = true;
                        }
                        document.getElementById(id).removeAttribute("checked");
                        players[nbPartie].splice(players[nbPartie].indexOf(id), 1);
                    } else {
                        if (metoru >= 5) {

                            // Vérifie le maximum de joueur possible
                            alert("Pas plus de 5 à la fois guignol");
                            document.getElementById(id).removeAttribute("checked");
                        } else {
                            document.getElementById(id).setAttribute("checked", "checked");
                            
                            metoru++;
                            if(metoru > 1){

                                // Vérifie le minimum de joueur possible
                                document.getElementById("btnInviter").removeAttribute("disabled");
                            }
                            if (players[nbPartie] === undefined) {
                                players[nbPartie] = [];
                            }
                            players[nbPartie].push(id);
                        }
                    }
                });
            }

            // Affiche la fenetre d'invitation 
            document.getElementById("fenetreInvit").style.display = "block";
        }
        sock.emit("invitation", null);
    }

     /**
     * Quitte la fenetre d'invitation
     */
    function annulerInvit() {
        document.getElementById("fenetreInvit").style.display = "none";
    }

    /**
     * Envoie les invitations aux membres séléctionnés
     */
    function invitation() {
        console.log("invitation : "+players[nbPartie]);
        if (players[nbPartie] !== undefined  && players[nbPartie] !== []) {
            document.getElementById("fenetreInvit").style.display = "none";
            let invitation = {
                to: players[nbPartie],
                from: currentUser,
                partie: partieInvite
            };
            sock.emit("invitation", invitation);
            for (let i in players[nbPartie]) {
                let invit = {
                    from: currentUser,
                    to: players[nbPartie][i],
                    text: "<a id=\"p_" + partieInvite + "\">Clique pour rejoindre mon invitation</a>",
                    date: Date.now(),
                    id_partie: 0
                };

                sock.emit("message", invit);
            }
            let join = {
                joiner: currentUser,
                partie: partieInvite
            };


            iniTabs(partieInvite);
            tabPartie.push(partieInvite);
            sock.emit("joinGame", join);
            nbPartie++;
            host = currentUser;
            creationOnglet(partieInvite);
        }
    }

    /**
     * Fait apparaitre l'onglet de la fenetre de jeu
     */
    function creationOnglet(partieEnCours) {
        if(document.getElementById("p_"+partieEnCours) !== null){
            document.getElementById("p_"+partieEnCours).removeAttribute("id");
        }

        let nouvelOnglet = document.createElement("li");
        let nbPartieInvite = partieEnCours;
        let id = "Partie " + partieEnCours;
        nouvelOnglet.innerHTML = id;
        nouvelOnglet.setAttribute("id", id);
        nouvelOnglet.style.cursor = "pointer";
        let taille = 0;
        nouvelOnglet.style.left = "" + taille + "px";
        document.querySelector("#listePartie ul").appendChild(nouvelOnglet);
        let input = document.createElement("input");
        input.setAttribute("type", "radio");
        input.setAttribute("name", "btnScreen");
        input.setAttribute("id", "radio" + (nbPartieInvite));

        let div = document.createElement("div");
        div.setAttribute("class", "gameScreen");
        div.setAttribute("id", "gameScreen" + (nbPartieInvite));

        // Ajoute le code HTML d'une partie
        div.innerHTML =
            "<img id=\"imageTitre\" src=\"../images/titre.png\">"+
            
            "<div class = \"contentGame contentStyle\" id=\"contentGame"+(nbPartieInvite)+"\">" +
                "<h2>Chat partie "+partieInvite +" - <span id=\"login_p_"+(nbPartieInvite)+"\">"+currentUser+"</span></h2>" +
                "<h3>Joueurs connectés</h3>" +
                "<aside>" +
                "</aside>" +
                "<main>" +
                "</main>" +
                "<footer>" +
                    "<input type=\"text\" class =\"monMessageGame textStyle\" id=\"monMessage_p_"+(nbPartieInvite)+"\">" +
                    "<input type=\"button\" id =\"textToSpeech"+(nbPartieInvite)+"\" value=\"🎤\" class=\"btnStyle\">"+
                    "<input type=\"button\" value=\"Envoyer\" class =\"btnJouerGame btnStyle\" id=\"btnEnvoyer_p_"+(nbPartieInvite)+"\">" +
                    "<input type=\"button\" value=\"Image\" class =\"btnImageGame btnStyle\" id=\"btnImage_p_"+(nbPartieInvite)+"\">" +
                    "<input type=\"button\" value=\"Chat\" class =\"btnChat btnStyle\" id=\"btnChat_p_"+(nbPartieInvite)+"\">" +
                    "<input type=\"button\" value=\"Quitter\" class =\"btnQuitter btnStyle\" id=\"btnQuitterGame_p_"+(nbPartieInvite)+"\">" +
                "</footer>" +
                "<div class =\"bcImageGame\" id=\"bcImage"+nbPartieInvite+"\" style=\"display: none;\">" +
                    "<header>" +
                        "<input type=\"text\" class=\"rechercheGame textStyle \" id=\"recherche"+(nbPartieInvite)+"\" placeholder=\"Tapez ici le texte de votre recherche\">" +
                        "<input type=\"button\" value=\"Recherche \" class=\"btnRechercherGame btnStyle\" id=\"btnRechercher_p_"+(nbPartieInvite)+"\">" +
                    "</header>" +
                    "<div class =\"bcResultsGame\" id=\"bcResults"+nbPartieInvite+"\"></div>" +
                        "<footer><input type=\"button\" value=\"Fermer\" class =\"btnFermer btnStyle\" id=\"btnFermer_p_"+(nbPartieInvite)+"\"></footer>" +
                    "</div>" +
                "</div>" +
                "<div class =\"gameMain\" id=\"gameMain_p_"+nbPartieInvite+"\">" +
                "<div class='message'  id=\"message"+nbPartieInvite+"\"> </div>"+
                "<div class='defausse' id=\"defausse"+nbPartieInvite+"\"></div>"+

                "</div>" +
                "<table id=\"table"+nbPartieInvite+"\">"+
                    "<thead>"+
                        "<tr>"+
                            "<th colspan=\"6\">Tableau des scores</th>"+
                        "</tr>"+
                    "</thead>"+
                    "<tbody>"+
                        "<tr>"+
                        "</tr>"+
                        "<tr>"+
                        "</tr>"+
                    "</tbody>"+
                "</table>"+
            "</div>";

        document.querySelector("body").appendChild(input);
        document.querySelector("body").appendChild(div);

        // Ajoute le bouton pour lancer une partie du côté de l'hote uniquement
        if(host != null){
            let inputGameStart = document.createElement("input");
            inputGameStart.setAttribute("type", "button");
            inputGameStart.setAttribute("value", "Lancer la partie");
            inputGameStart.setAttribute("class","btnLancer");
            inputGameStart.setAttribute("id", "btnLancer_p_"+nbPartieInvite);
            document.getElementById("gameMain_p_"+nbPartieInvite).appendChild(inputGameStart);
            document.getElementById("btnLancer_p_" + nbPartieInvite).addEventListener("click", initialiserPartie);
        }
        host=null;

        // Ajout d'un bouton pour revenir au chat principal
        document.getElementById("btnChat_p_" + (nbPartieInvite)).addEventListener("click", function () {
            document.getElementById("radio0").checked = true;
            actualiserHistorique();
            document.getElementById("listePartie").style.display = "block";
            document.getElementById("histoPartie").style.display = "block";
            
        });

        // Ajout d'un bouton mute du synthétiseur vocal
        document.getElementById("textToSpeech" + nbPartieInvite).addEventListener("click", function(){
            if(mute==0){
                mute++;
                document.getElementById("textToSpeech" + nbPartieInvite).classList.add("muteOn");
            }else{
                mute--;
                document.getElementById("textToSpeech" + nbPartieInvite).classList.remove("muteOn");
            }
        });

        // Listener des boutons du chat de la partie
        document.getElementById("btnEnvoyer_p_" + nbPartieInvite).addEventListener("click", envoyerMsgGame);
        document.getElementById("btnImage_p_" + nbPartieInvite).addEventListener("click", toggleImage);
        document.getElementById("btnFermer_p_" + nbPartieInvite).addEventListener("click", toggleImage);
        document.getElementById("btnRechercher_p_" + nbPartieInvite).addEventListener("click", rechercher);
        document.getElementById("bcResults" + nbPartieInvite).addEventListener("click", choixImage);
        document.getElementById("btnQuitterGame_p_" + (nbPartieInvite)).addEventListener("click", quitterGame);
        document.getElementById(id).addEventListener("click", creationFenetreJeu);
    }

                        /****************************************************
                         *          FONCTIONS CREATION FENETRE JEU          *
                         ****************************************************/

    /**
     * Créer un tableau de score en fonction du nombre de joueur pour une partie donnée
     */
    function creationTableauScore(newList, game) {

        if (game !== 0){
            document.querySelector(".gameScreen #table"+game+" tbody tr:nth-of-type(1)").innerHTML = "";
            document.querySelector(".gameScreen #table"+game+" tbody tr:nth-of-type(2)").innerHTML = "";
            console.log(newList);
            for(let i=0;i<newList.length;i++){
                let tdName = document.createElement("td");
                document.querySelector(".gameScreen #table"+game+" tbody tr:nth-of-type(1)").appendChild(tdName);
                let tdNameText;

                // Ajout des classes
                switch(i){
                    case 0:
                        tdNameText = document.createTextNode("Communiste ☭");
                        break;
                    case 1 :
                        tdNameText = document.createTextNode("Templier ✠");
                        break;
                    case 2:
                        tdNameText = document.createTextNode("Scientifique ⚛");
                        break;
                    case 3:
                        tdNameText = document.createTextNode("Musulman ☪");
                        break;
                    case 4:
                        tdNameText = document.createTextNode("Japonais ☢");
                        break;
                    case 5:
                        tdNameText = document.createTextNode("Hufflenien ♪");
                        break;
                }
                tdName.appendChild(tdNameText);
                let tdScore = document.createElement("td");
                document.querySelector(".gameScreen #table"+game+" tbody tr:nth-of-type(2)").appendChild(tdScore);
                let tdScoreText = document.createTextNode("0");
                tdScore.setAttribute("id", "score_"+newList[i]+"_"+game);
                tdScore.appendChild(tdScoreText);
            }

        }
    }

    /**
     * S'effectue quand on clique sur la partie qu'on veut afficher
     * On va alors activer le bouton radio correspondant
     */

    function creationFenetreJeu() {
        let partie = this.id;
        let reg = new RegExp(/[^\d]/g);
        let nb = partie;
        nb = nb.replace(reg, "");
        const res = parseInt(nb, 10);
        partie = partie.replace(/Partie .*/, "radio" + res);
        document.getElementById(partie).checked = true;
    }

    /**
     * Permet de rejoindre une partie
     */
    function rejoindrePartie() {
        let id = getIdInt(this.id);
        console.log("Join game num° "+id);
        let join = {
            joiner: currentUser,
            partie: id
        };
        sock.emit("joinGame", join);
        iniTabs(id);
        tabPartie.push(id);
        let ind = partiesInvites.indexOf(id);
        partiesInvites.splice(ind,1);
        console.log("p_" + id);
        removeIDpartie(id);
        creationOnglet(id);
        fromInvit=currentUser;
    }

    /**
     * Initialise la partie
     */
    function initialiserPartie(){
        let partieLancee = getIdInt(this.id);
        if(liste_joueurs[partieLancee].length>2) {
            document.getElementById("gameMain_p_" + partieLancee).removeChild(document.getElementById("btnLancer_p_" + partieLancee));
            sock.emit("initialiserPartie", partieLancee);
        }
    }

    /**
     * Met en place le listener du bouton pour miser
     */
    function setBtnMiserListener(partieEnCours) {
        document.getElementById("btnMiser" + partieEnCours).addEventListener("click", function (e) {
            let id = getIdInt(this.id);
            if (document.getElementById("pile_" + currentUser + "_" + id).childElementCount < 1) {
                return;
            }

            let miseValue = document.getElementById("txtMiser" + id).value;

            if (isNaN(parseInt(miseValue))) {
                return;
            }

            let miseFinale = false;
            let miseActuel;
            let miseActuelhtml = document.getElementById("miseGenerale" + partieEnCours).innerHTML;
            miseActuel = getIdInt(miseActuelhtml);
            // Vérification de la validité de la mise
            if (parseInt(miseValue) <= miseActuel || parseInt(miseValue) === 0) {
                document.getElementById("txtMiser" + id).value = "";
                return;
            }

            let nbCartesSurPlateau = getNombreCartesPlateau(partieEnCours);

            if (parseInt(miseValue) <= 0 || parseInt(miseValue) > nbCartesSurPlateau) {
                document.getElementById("txtMiser" + id).value = "";
                return;
            }
            if (parseInt(miseValue) === nbCartesSurPlateau) {
                miseFinale = true;
            }

            // Mise correcte, mise à jour
            let mise = {
                partieEnCours: partieEnCours,
                joueur: currentUser,
                mise: miseValue,
                miseFinale: miseFinale
            };
            mon_tour[partieEnCours] = false;
            sock.emit("mise", mise);
            document.getElementById("txtMiser" + id).value = "";
        });
    }

    /**
     * Affiche le plateau de jeu, avec les piles, la défausse, les mains et les messages et boutons
     */
    function afficherPlateau(partieEnCours, cranes){
        let gameMain = document.getElementById("gameMain_p_"+partieEnCours);

        // Mise en place de la mise
        let divMise = document.createElement("div");
        divMise.setAttribute("class","divMise");
        divMise.setAttribute("id","divMise"+partieEnCours);

        let txtMiser = document.createElement("input");
        txtMiser.setAttribute("class","txtMiser");
        txtMiser.setAttribute("id","txtMiser"+partieEnCours);
        txtMiser.setAttribute("type","text");

        let btnMiser = document.createElement("input");
        btnMiser.setAttribute("class","btnMiser");
        btnMiser.setAttribute("id","btnMiser"+partieEnCours);
        btnMiser.setAttribute("type","button");
        btnMiser.setAttribute("value","Miser");

        gameMain.appendChild(divMise);
        divMise.appendChild(txtMiser);
        divMise.appendChild(btnMiser);
        
        setBtnMiserListener(partieEnCours);

        // Affiche les joueurs et leurs piles
        for(let i=0;i<liste_joueurs[partieEnCours].length; i++){
            let toDom="";
            let joueur= liste_joueurs[partieEnCours][i];
            toDom = document.createElement("div");
            toDom.setAttribute("class","joueur");
            toDom.setAttribute("id",joueur+"_"+partieEnCours);
            gameMain.insertBefore(toDom, document.getElementById("message"+partieEnCours));
            let main = document.createElement("main");
            let pile = document.createElement("div");
            let nbCartePile = document.createElement("div");

            pile.setAttribute("class","pile");
            pile.setAttribute("id","pile_"+joueur+"_"+partieEnCours);
            
            nbCartePile.setAttribute("class","nbCartePile");
            nbCartePile.setAttribute("id","nbCartePile_"+joueur+"_"+partieEnCours);
            nbCartePile.innerHTML="0";
            
            document.getElementById(joueur+"_"+partieEnCours).appendChild(pile);
            document.getElementById(joueur+"_"+partieEnCours).appendChild(nbCartePile);
            document.getElementById(joueur+"_"+partieEnCours).appendChild(main);

            // Affiche les cartes des joueurs
            for(let j=0;j<4;j++){
                let carte = document.createElement("div");
                carte.setAttribute("class","carte");
                carte.setAttribute("id","c_"+j+"_"+joueur+"_"+partieEnCours);

                if(cranes[i] ===j){
                    carte.classList.add("crane");
                }else{
                    carte.classList.add("rose");
                }
                if(joueur === currentUser){
                    carte.classList.add("retournee");
                }

                switch(i){
                    case 0:
                        carte.classList.add("communiste");  
                        break;
                    case 1 :  
                        carte.classList.add("templier");
                        break;
                    case 2:
                        carte.classList.add("scientifique");
                        break;
                    case 3:
                        carte.classList.add("musulman");
                        break;
                    case 4:
                        carte.classList.add("japonais");
                        break;
                    case 5:
                        carte.classList.add("hufflenien");
                        break;
                }

                document.querySelector("#"+joueur+"_"+partieEnCours+" main").appendChild(carte);
                if(joueur === currentUser){
                    let indice = i+1;
                    indices[partieEnCours] = indice;
                    enableListenerMain(partieEnCours);
                }
            }

            //Affiche les pseudos
            let pseudo = document.createElement("p");
            pseudo.innerHTML = liste_joueurs[partieEnCours][i];
            pseudo.setAttribute("class","pseudo");
            document.getElementById(joueur+"_"+partieEnCours).appendChild(pseudo);

        }
        creaMiseGenerale(partieEnCours,0);
    }

    /**
     * Mise en place de la mise générale
     */
    function creaMiseGenerale(partieEnCours, mise){

        let miseGenerale = document.createElement("div");
        miseGenerale.setAttribute("id","miseGenerale"+partieEnCours);
        miseGenerale.setAttribute("class","miseGenerale");
        miseGenerale.innerHTML = "Mise actuelle : "+mise;

        let btnCoucher = document.createElement("input");
        btnCoucher.setAttribute("id","btnCoucher"+partieEnCours);
        btnCoucher.setAttribute("type","button");
        btnCoucher.setAttribute("class","btnCoucher");
        btnCoucher.setAttribute("value","Se coucher");

        let divMise = document.querySelector("#divMise"+partieEnCours);
        divMise.insertBefore(miseGenerale,document.querySelector("#txtMiser"+partieEnCours));
        divMise.appendChild(btnCoucher);
        btnCoucher.addEventListener("click",seCoucher);
        btnCoucher.disabled = true;
    }

                            /****************************************************
                             *                FONCTIONS LISTENERS               *
                             ****************************************************/

    /**
     * Ajoute les listeners aux piles
     */
    function addPileListener(partieEnCours){
        maxNbPile= getNombreCartesPile(partieEnCours,currentUser);
        for(let i=0;i<liste_joueurs[partieEnCours].length;i++){
            document.getElementById("pile_"+liste_joueurs[partieEnCours][i]+"_"+partieEnCours).addEventListener("click",pileVersDefausse);
        }
    }

    /**
     * Applique un listener sur la main du joueur courant dans une partie
     */
    function enableListenerMain(partieEnCours){
        document.querySelector("#gameMain_p_"+partieEnCours+" #"+currentUser+"_"+partieEnCours+" > main").addEventListener("click", listenerMain);
    }

    /**
     * S'effectue quand on clique sur une carte de notre main
     * On va alors envoyer au serveur la carte qu'on veut jouer
     * @param e Evenement
     */

    function listenerMain(e){
        if (e.target.tagName === "MAIN") {
            return;
        }

        let elt = e.target;
        while(! elt.classList.contains("carte")){
            elt = elt.parentElement;
        }
        let id =elt.id;

        let partieEnCours = getIdDoubleInt(id);

        let obj= {
            joueur: currentUser,
            partieEnCours:partieEnCours,
            carte: elt.id

        };
        if(!mon_tour[partieEnCours]){
            return;
        }
        sock.emit("carteSelectionnee",obj);
        mon_tour[partieEnCours] = false;
    }

    /**
     * Enlève les listeners de la main d'un joueur
     */
    function disableListenerMain(partieEnCours){
        let main = document.querySelector("#gameMain_p_"+partieEnCours+" .joueur:nth-of-type("+indices[partieEnCours]+") > main");
        if(main != null){
            main.removeEventListener("click",listenerMain);
        }
    }

    /**
     * Enlève les listeners des piles d'une partie
     */
    function disableListenerPile(partieEnCours){
        maxNbPile=0;
        for(let i=0;i<liste_joueurs[partieEnCours].length;i++){
            document.getElementById("pile_"+liste_joueurs[partieEnCours][i]+"_"+partieEnCours).removeEventListener("click",pileVersDefausse);
        }
    }

                            /****************************************************
                             *         FONCTIONS D'ACTUALISATION DU JEU         *
                             ****************************************************/

    /**
     * Permet le retournement des cartes des piles vers la défausse et traite si un crâne est retourné
     */
    function pileVersDefausse(e){
        let elt = e.target;
        let perdu=false;
        let gagne=false;
        let id = elt.id;
        let pileDeJoueur = getPseudo(id);
        let partieEnCours = getIdDoubleInt(id);
        if (e.target.id.match(/pile_/) ) {
            return;
        }

        if(nbCartesChoisis[partieEnCours]>=maxNbPile  || pileDeJoueur === currentUser) {
            nbCartesChoisis[partieEnCours]++;
            while (!elt.classList.contains("carte")) {
                elt = elt.parentElement;
            }

            if(elt.classList.contains("crane")){
                perdu=true;
                mon_tour[partieEnCours]=false;
            }

            if(!perdu && nbCartesChoisis[partieEnCours]===getMiseGenerale(partieEnCours)){
                gagne =true;
                mon_tour[partieEnCours]=false;
            }

            let obj = {
                joueur: currentUser,
                pileDeJoueur: pileDeJoueur,
                partieEnCours: partieEnCours,
                carte: elt.id,
                perdu:perdu,
                gagne:gagne

            };

            sock.emit("carteSelectionneePile", obj);
        }
    }

    /**
     * Met à jour la mise générale d'une partie
     */
    function updateMiseGenerale(partieEnCours,mise){
        let miseGenerale = document.getElementById("miseGenerale"+partieEnCours);
        miseGenerale.innerHTML = "Mise actuelle : "+mise;
    }

    /**
     * Ajoute une carte à la pile d'un joueur dans une partie et la retire de la main de celui ci
     */
    function actualiserPile(partieEnCours, joueur, carte){
        let pile = document.getElementById("pile_"+joueur+"_"+partieEnCours);
        let carte_a_remove = document.getElementById(carte);
        let query = "#"+joueur+"_"+partieEnCours+" main";
        if(joueur===currentUser){
            carte_a_remove.classList.remove("retournee");
        }
        document.querySelector(query).removeChild(carte_a_remove);
        pile.appendChild(carte_a_remove);

        document.querySelector("#nbCartePile_"+joueur+"_"+partieEnCours).innerHTML = pile.childElementCount;
    }

    /**
     * Ajoute une carte à la défausse et la retire de la pile dans laquelle elle a été tiré
     */
    function actualiserDefausse(partieEnCours,pileDeJoueur,carte){
        let pile = document.getElementById("pile_"+pileDeJoueur+"_"+partieEnCours);
        let defausse = document.getElementById("defausse"+partieEnCours);
        console.log("la carte : "+carte);
        let carte_a_remove = document.getElementById(carte);

        pile.removeChild(carte_a_remove);
        document.querySelector("#nbCartePile_"+pileDeJoueur+"_"+partieEnCours).innerHTML = pile.childElementCount;
        carte_a_remove.classList.add("selectionne");
        defausse.appendChild(carte_a_remove);
    }

    /**
     * Actualise les points du vainqueur dans le tableau des scores
     */
    function actualiserTableau(partieEnCours, vainqueur,points){
        let tab = document.getElementById("score_"+vainqueur+"_"+partieEnCours);
        tab.innerHTML = points;
        let pile = document.getElementById("pile_"+vainqueur+"_"+partieEnCours);
        if(pile!==null) {
            pile.classList.add("retournee");
        }
    }

    /**
     * Fonctionnalité "se coucher"
     */
    function seCoucher(){
        let partieEnCours = getIdInt(this.id);
        document.getElementById(this.id).disabled=true;
        let couche ={
            partieEnCours:partieEnCours,
            joueur:currentUser,
            mise:getMiseGenerale(partieEnCours)
        };
        mon_tour[partieEnCours]=false;
        sock.emit("seCouche",couche);
    }

                            /****************************************************
                             *             FONCTIONS DE SUPPRESSION             *
                             ****************************************************/

    /**
     * Permet de retirer une carte de la main d'un joueur
     */
    function retirerCarte(partieEnCours, joueurAEnlever){
        let query = document.querySelector("#"+joueurAEnlever+"_"+partieEnCours+" main");
        query.addEventListener("click",retirerCarteListener);
    }

    /**
     * Retire une carte aléatoirement de la main du joueur courant
     */
    function retirerCarteRandom(partieEnCours){
        let isDcd =false;
        let nb_cartes_restantes = getNombreCarteMain(partieEnCours);
        let carte;
        if(nb_cartes_restantes===1){
            carte = document.querySelector("#"+currentUser+"_"+partieEnCours+" main").firstElementChild.id;
            document.querySelector("#"+currentUser+"_"+partieEnCours+" main").removeChild(document.querySelector("#"+currentUser+"_"+partieEnCours+" main").firstChild);
            isDcd=true;
        }else{
            let rand = Math.floor(Math.random()*4);
            while(document.getElementById("c_"+rand+"_"+currentUser+"_"+partieEnCours) ==null){
                rand++;
                if(rand===4){
                    rand=0;
                }
            }
            carte = document.getElementById("c_"+rand+"_"+currentUser+"_"+partieEnCours).id;
        }
        let obj ={
            joueur:currentUser,
            partieEnCours:partieEnCours,
            carte:carte,
            elimine:isDcd
        };

        sock.emit("carteARetirer",obj);
        mon_tour[partieEnCours]=true;
    }

    /**
     * Retire les cartes d'un joueur du plateau quand celui-ci est éliminé
     */
    function retirerCartePlateau(partieEnCours,joueur,carte){
        let nb_cartes_restantes = getNombreCarteMain(partieEnCours);
        let obj ={
            joueur:currentUser,
            partieEnCours:partieEnCours,
            elimine:true
        };

        if(joueur === currentUser && nb_cartes_restantes===0){
            sock.emit("joueurElimine", obj);
            return;
        }

        let main = document.querySelector("#"+joueur+"_"+partieEnCours+" main");
        let carte_a_remove = document.getElementById(carte);
        main.removeChild(carte_a_remove);

        if(joueur === currentUser && nb_cartes_restantes===1){
            sock.emit("joueurElimine", obj);
        }
    }

    /**
     * Enlève les listeners des cartes
     */
    function retirerCarteListener(e){
        let elt = e.target;
        let id = elt.id;
        let num_partie = getIdDoubleInt(id);
        let pseudo = getPseudo(id);
        let obj ={
            joueur:pseudo,
            partieEnCours:num_partie,
            carte:id
        };

        sock.emit("carteARetirer",obj);
        mon_tour[num_partie]=true;
        let query = document.querySelector("#"+pseudo+"_"+num_partie+" main");
        query.removeEventListener("click",retirerCarteListener);
    }

    /**
     * Remet en place l'affichage à la fin de chaque manche
     */
    function resetAffichage(partieEnCours){
        let defausse = document.getElementById("defausse"+partieEnCours);

        while(defausse.firstChild){
            let carte = defausse.firstChild;
            let carte_id = defausse.firstElementChild.id;
            let main_id = getPseudo(carte_id);
            carte.classList.remove("selectionne");
            if(currentUser===main_id){
                carte.classList.add("retournee");
            }

            let main = document.querySelector("#"+main_id+"_"+partieEnCours+" main");
            defausse.removeChild(defausse.firstChild);
            if(main!==null) {
                main.appendChild(carte);
            }
        }

        for(let j=0;j<liste_joueurs[partieEnCours].length;j++){
            let pile = document.getElementById("pile_"+liste_joueurs[partieEnCours][j]+"_"+partieEnCours);
            let pileCompteur =  document.getElementById("nbCartePile_"+liste_joueurs[partieEnCours][j]+"_"+partieEnCours);
            pileCompteur.innerHTML=0;
            if(pile!=null) {
                while (pile.firstChild) {
                    let carte = pile.firstChild;
                    let carte_id = pile.firstElementChild.id;
                    let main_id = getPseudo(carte_id);
                    carte.classList.remove("selectionne");
                    if (currentUser === main_id) {
                        carte.classList.add("retournee");
                    }
                    let main = document.querySelector("#" + main_id + "_" + partieEnCours + " main");
                    pile.removeChild(pile.firstChild);
                    main.appendChild(carte);
                }
            }
        }
    }

    /**
     * Supprime un joueur d'un partie
     */
    function deleteJoueur(joueur,partieEnCours){
        let joueurToDelete = document.getElementById(joueur+"_"+partieEnCours);
        let gameMain = document.getElementById("gameMain_p_"+partieEnCours);
        if(joueurToDelete!=null){
            gameMain.removeChild(joueurToDelete);
        }
    }

    /**
     * Supprime une partie si elle existe
     */
    function removeIDpartie(num_partie) {
        if (document.getElementById("p_" + num_partie) !== null) {
            let ind = partiesInvites.indexOf(num_partie);
            partiesInvites.splice(ind,1);
            document.getElementById("p_" + num_partie).classList.remove("lienActif");
            document.getElementById("p_" + num_partie).removeEventListener("click", rejoindrePartie);
            document.getElementById("p_" + num_partie).removeAttribute("id");
        }
    }

                            /****************************************************
                             *                 FONCTIONS QUITTER                *
                             ****************************************************/

    /**
     *  Supprime la partie de la partie, renvoie sur le chat principal et actualise l'historique du chat principal
     */
    function quitterGame(id,elimine=true) {
        if(partieAquitter>0){
            id=partieAquitter;
        }

        document.getElementById("radio0").checked = true;
        actualiserHistorique();
        let res;
        let obj;
        if(id>=1) {
            res=id;
            obj={
                joueur:currentUser,
                cartes: getIDsCartesMain(res),
                cartesPile:getIDsCartesPile(res),
                cartesDefausse:getIDsCartesDefausse(res),
                partieEnCours:res,
                monTour:mon_tour[res],
                elimine:elimine,
                mise:miseAutorise[res]
            };
            document.querySelector("body").removeChild(document.getElementById("gameScreen"+res));
            document.querySelector("#listePartie ul").removeChild(document.getElementById("Partie "+res));

        }else{
            let partie = this.id;
            let reg = new RegExp(/[^\d]/g);
            let nb = partie;
            elimine=false;
            if(nb!==undefined) {
                nb = nb.replace(reg, "");
                res = parseInt(nb, 10);
                res = getIdInt(partie);
                obj = {
                    joueur: currentUser,
                    cartes: getIDsCartesMain(res),
                    cartesPile:getIDsCartesPile(res),
                    cartesDefausse:getIDsCartesDefausse(res),
                    partieEnCours: res,
                    monTour: mon_tour[res],
                    elimine:elimine,
                    mise:miseAutorise[res]
                };
                partie = partie.replace(/btnQuitterGame_p_.*/, "Partie " + res);
                document.querySelector("#listePartie ul").removeChild(document.getElementById(partie));
                partie = partie.replace(/Partie .*/, "gameScreen" + (res));
                document.querySelector("body").removeChild(document.getElementById(partie));
            }
        }

        for(let i=0; i< tabPartie.length;++i){
            if(tabPartie[i]===res){
                delete tabPartie[i];
                delete liste_joueurs[i];
                delete indices[i];
                delete miseAutorise[i];
                delete mon_tour[i];
                delete nbCartesChoisis[i];
                break;
            }
        }
        document.getElementById("radio"+(res)).remove();
        sock.emit("quitGame",obj);
        partieAquitter=-1;
    }

    /**
     * Quitte le chat principal 
     */
    function quitter() {

        if(tabPartie!=null && tabPartie.length>0) {
            for (let i = 0; i < tabPartie.length; i++) {
                if(tabPartie[i]!==undefined){
                    quitterGame(tabPartie[i],false);
                }

            }
        }
        currentUser = null;

        sock.emit("logout");

        document.getElementById("radio-1").checked = true;
        document.getElementById("listePartie").style.display = "none";
        document.getElementById("histoPartie").style.display = "none";
    }

                            /****************************************************
                             *                  EVENT LISTENERS                 *
                             ****************************************************/

    /**
     *  Mapping des boutons de l'interface avec des fonctions du client.
     */
    document.getElementById("btnConnecter").addEventListener("click", connect);
    document.getElementById("pseudo").addEventListener("keydown", function(e){
        if (e.keyCode === 13) {
            connect();
        }
    });
    document.getElementById("btnQuitter").addEventListener("click", quitter);
    document.getElementById("btnFermer").addEventListener("click", toggleImage);
    document.getElementById("btnImage").addEventListener("click", toggleImage);
    document.getElementById("btnEnvoyer").addEventListener("click", envoyer);
    document.getElementById("btnRechercher").addEventListener("click", rechercher);
    document.getElementById("btnInviter").addEventListener("click",invitation);
    document.getElementById("btnAnnulerInvit").addEventListener("click",annulerInvit);
    document.getElementById("recherche").addEventListener("keydown", function(e) {
        if (e.keyCode === 13) {
            rechercher();
        }
    });
    document.getElementById("bcResults").addEventListener("click", choixImage);
    document.getElementById("monMessage").addEventListener("keydown", function(e) {
        if (e.keyCode === 13) {
            envoyer();
        }
    });
    document.getElementById("btnJouer").addEventListener("click", fenetreInvitation);
});
