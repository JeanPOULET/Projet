document.addEventListener("DOMContentLoaded", function(_e) {

    /*** Liste des "bugs" trouvés ***
     * Bug graphique quand suppression partie
     * Lien d'invitation bugué quand plusieurs reçus d'affilés
     * Pseudo avec espace pour invit
     * mp chat jeu
     * 
    */

    /*** ToDo
     * les ia...
     * chiffre pour les piles
     * message mise
     */

    /*** ToFerBO
     * style chat
     * style acceuil
     * 
     */

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

    var partieAquitter=-1;

    //
    //var nbPoints=null;

    // on attache les événements que si le client est connecté.
    sock.on("bienvenue", function (id) {
        if (currentUser) {
            document.querySelector("#content main").innerHTML = "";
            document.getElementById("monMessage").value = "";
            document.getElementById("login").innerHTML = id;
            document.getElementById("radio0").checked = true;
            currentUser = id;
            fromInvit = currentUser;
        }
    });
    sock.on("message", function (msg) {
        if (currentUser) {
            afficherMessage(msg);
        }
    });
    sock.on("liste", function (liste) {
        users = liste;
        if (currentUser) {
            afficherListe(liste, 0);
        }
    });

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

    sock.on("invitation", function (invit) {
        if (currentUser) {
            console.log("invitationneur : ", invit.from);
            console.log("partieInvite actualisé : "+invit.partie);
            partieInvite = invit.partie;
            fromInvit = currentUser;
            if (invit.from != null) {
                fromInvit = invit.from;

            }
        }

    });

    sock.on("suppressionInvitation", function (num_partie) {
        console.log("je dois delete la partie : "+num_partie);
        removeIDpartie(num_partie);
    });

    sock.on("iniPartie",function(initialisation){
        console.log("La partie est lancée n°"+initialisation.partieLancee);
        afficherPlateau(initialisation.partieLancee, initialisation.cranes);
        creationTableauScore(liste_joueurs[initialisation.partieLancee], initialisation.partieLancee);
    });

    sock.on("debutManche",function(manche){
        document.getElementById("message"+manche.num_partie).innerHTML ="C'est à "+manche.joueur+" de jouer !";
        actualiserTabTour(manche.num_partie,manche.joueur);

    });

    sock.on("nouvelManche",function(nouvel_manche){
        document.getElementById("message"+nouvel_manche.partieLancee).innerHTML ="C'est à "+nouvel_manche.prochainJoueur+" de jouer !";
        actualiserTabTour(nouvel_manche.partieLancee,nouvel_manche.prochainJoueur);
        actualiserPile(nouvel_manche.partieLancee,nouvel_manche.joueur,nouvel_manche.carte);
    });

    sock.on("mise",function(mise){
        document.getElementById("message"+mise.partieLancee).innerHTML ="C'est à "+mise.prochainJoueur+" de jouer !";
        miseAutorise[mise.partieLancee] =true;
        actualiserTabTour(mise.partieLancee,mise.prochainJoueur);
        updateMiseGenerale(mise.partieLancee,mise.mise);
        disableListenerMain(mise.partieLancee);

    });

    sock.on("joueurSeCouche",function(couche){
        document.getElementById("message"+couche.partieLancee).innerHTML =couche.joueur+" se couche ! C'est à "+couche.prochainJoueur+" de joueur !";
        actualiserTabTour(couche.partieLancee,couche.prochainJoueur);
    });

    sock.on("pileVersDefausse",function(pile){
        actualiserDefausse(pile.partieLancee,pile.pileDeJoueur,pile.carte);
    });

    sock.on("gagneManche",function(victoire){
        actualiserTableau(victoire.partieLancee, victoire.vainqueur,victoire.points);
    });

    sock.on("perdManche",function(defaite){
        if(defaite.perdant){
            console.log("J'ai perdu la manche !")
        }

        if(defaite.doitEnleverCarte === currentUser && defaite.perdant !==currentUser) {

            retirerCarte(defaite.partieLancee,defaite.perdant);
        }else if (defaite.perdant === defaite.doitEnleverCarte && defaite.perdant===currentUser){
            retirerCarteRandom(defaite.partieLancee);

        }

    });

    sock.on("joueurPart",function(aurevoir){
        deleteJoueur(aurevoir.joueur,aurevoir.id_partie);
    });

    sock.on("resetManche",function(reset){
        let msg=reset.joueur;
        if(reset.victoire && !reset.victoireTotale){
            msg +=" a gagné la manche ! "
        }else if(!reset.victoire && !reset.victoireTotale){
            msg +=" a perdu la manche ! "+reset.prochainJoueur+ " doit lui enlever une carte !";
        }else{
            msg +=" a gagné la partie !"
        }
        if(!reset.victoireTotale) {
            document.getElementById("message" + reset.partieLancee).innerHTML = msg + "  C'est à " + reset.prochainJoueur + " de jouer !";
        }else{
            document.getElementById("message" + reset.partieLancee).innerHTML = msg + " Fin de la partie dans 10 secondes !";
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

            setTimeout(quitterGame,4000);
        }


    });

    sock.on("revelation",function(revel){
        document.getElementById("message"+revel.partieLancee).innerHTML =revel.joueur+" tire les cartes !";
        miseAutorise[revel.partieLancee] =false;
        if(revel.joueur === currentUser){
            document.getElementById("btnMiser"+revel.partieLancee).disabled = true;
            document.getElementById("btnCoucher" + revel.partieLancee).disabled = true;
            revelerCartes(revel.partieLancee);
        }

    });

    sock.on("carteRetiree",function(obj){
       retirerCartePlateau(obj.partieLancee,obj.joueur,obj.carte);

    });

    sock.on("joueurElimine",function(obj){
        document.getElementById("message"+obj.partieLancee).innerHTML =obj.joueur+" est eliminé !";
        if(obj.joueur===currentUser){
            quitterGame(obj.partieLancee);
        }
    });


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
     *  Connexion de l'utilisateur au chat.
     */
    function connect() {

        // recupération du pseudo
        var user = document.getElementById("pseudo").value.trim();
        if (!user) return;
        document.getElementById("radio0").check = true;
        currentUser = user;
        sock.emit("login", user);
    }


    /**
     *  Affichage des messages
     */
    function afficherMessage(data) {

        if (!currentUser) {
            return;
        }

        // affichage des nouveaux messages
        var bcMessages;
        console.log("id_partie : " + data.id_partie);
        if (data.id_partie === 0) {
            bcMessages = document.querySelector("#content main");
        } else {
            bcMessages = document.querySelector("#contentGame" + data.id_partie + " main");
        }

        var classe = "";

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
        } else {
            document.querySelector("#contentGame" + data.id_partie + " main > p:last-child").scrollIntoView();
        }

        console.log("fromInvit : ", fromInvit);
        if (data.id_partie === 0 && fromInvit !== currentUser) {
            console.log("aff=" + partieInvite);
            alert("Vous êtes invité par "+fromInvit+" pour la partie n°"+partieInvite+" !");
            document.getElementById("p_" + partieInvite).addEventListener("click", rejoindrePartie);
        }
        if(fromInvit===currentUser && data.id_partie==0 ){
            removeIDpartie(partieInvite);
        }
    }

    // traitement des emojis
    function traiterTexte(txt) {
        var ind = txt.indexOf("[img:");
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

    function afficherListe(newList, game) {
        console.log("game : ", game);
        if (game === 0) {
            document.querySelector("#content aside").innerHTML = newList.join("<br>");
        } else {
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

    function envoyerMsgGame() {
        let id_btn = this.id;
        let reg = new RegExp(/[^\d]/g);
        let nb = id_btn;
        nb = nb.replace(reg, "");
        const res = parseInt(nb, 10);
        console.log("res = " + res);
        let msg = document.getElementById("monMessage_p_" + res).value.trim();
        if (!msg) return;

        // message privé
        let to = null;
        if (msg.startsWith("@")) {
            let i = msg.indexOf(" ");
            to = msg.substring(1, i);
            msg = msg.substring(i);
        }
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
        console.log("fid= " + final_id);
        if (document.getElementById("bcImage" + final_id).style.display === "none") {
            document.getElementById("bcImage" + final_id).style.display = "block";
            document.getElementById("recherche" + final_id).focus();
        } else {
            document.getElementById("bcImage" + final_id).style.display = "none";
            document.getElementById("recherche" + final_id).value = "";
            document.getElementById("bcResults" + final_id).innerHTML = "";
        }
    }

    //renvoie en chaine le numéro d'id d'un résultat d'évenèment
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

    function getIdInt(id) {
        if (id === undefined || id == null) {
            return 0;
        }
        let reg = new RegExp(/[^\d]/g);
        id = id.replace(reg, "");
        return parseInt(id, 10);
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

    function choixImage(e) {
        let id = getIdInt(this.id);
        console.log("choixImg : ", id);
        if (e.target instanceof HTMLImageElement) {
            sock.emit("message", {from: currentUser, to: null, text: "[img:" + e.target.src + "]", id_partie: id});
            toggleImage(id, id);
        }

    }

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

                btn.innerHTML = "<input type='checkbox' name=\"" + id + "\" id=" + id + "><label id=\"label" + id + "\" for=" + id + ">" + id + "</label>";
                document.querySelector('#invitations').appendChild(btn);
                document.getElementById(id).addEventListener("click", function () {
                    if (document.getElementById(id).hasAttribute("checked")) {
                        metoru--;
                        if(metoru === 0){
                            document.getElementById("btnInviter").disabled = true;
                        }
                        document.getElementById("label" + id).style.backgroundColor = "initial";
                        document.getElementById(id).removeAttribute("checked");
                        players[nbPartie].splice(players[nbPartie].indexOf(id), 1);
                    } else {
                        if (metoru >= 5) {
                            alert("Pas plus de 5 à la fois guignol");
                            document.getElementById(id).removeAttribute("checked");
                            document.getElementById("label" + id).style.backgroundColor = "initial";
                        } else {
                            document.getElementById(id).setAttribute("checked", "checked");
                            document.getElementById("label" + id).style.backgroundColor = "yellow";
                            document.getElementById("label" + id).style.transitionDuration = "0.5s";
                            metoru++;
                            if(metoru > 0){
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
            document.getElementById("fenetreInvit").style.display = "block";
        }
        sock.emit("invitation", null);
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
            console.log(players);
            let join = {
                joiner: currentUser,
                partie: partieInvite
            };


            iniTabs(partieInvite);
            tabPartie.push(partieInvite);
            sock.emit("joinGame", join);
            nbPartie++;
            host = currentUser;
            creationOnglet();
        }
    }

    /*
     * Quitte la fenetre d'invitation
     */
    function annulerInvit() {
        document.getElementById("fenetreInvit").style.display = "none";
        //partieInvite--;
    }

    /*
     * Fait apparaitre l'onglet de la fenetre de jeu
     */
    function creationOnglet() {
        console.log("p_"+partieInvite);
        if(document.getElementById("p_"+partieInvite) !== null){
            document.getElementById("p_"+partieInvite).removeAttribute("id");
        }

        let nouvelOnglet = document.createElement("h2");
        let nbPartieInvite = partieInvite;
        let id = "Partie " + partieInvite;
        nouvelOnglet.innerHTML = id;
        nouvelOnglet.setAttribute("id", id);
        nouvelOnglet.style.cursor = "pointer";
        let taille = 0;
        for (let i = 0; i < document.getElementById("content").children.length; i++) {
            if (document.getElementById("content").children[i].tagName == "H2") {
                taille += document.getElementById("content").children[i].offsetWidth;
            }
        }
        nouvelOnglet.style.left = "" + taille + "px";
        document.getElementById("content").insertBefore(nouvelOnglet, document.querySelector("h3"));
        let input = document.createElement("input");
        input.setAttribute("type", "radio");
        input.setAttribute("name", "btnScreen");
        input.setAttribute("id", "radio" + (nbPartieInvite));

        let div = document.createElement("div");
        div.setAttribute("class", "gameScreen");
        div.setAttribute("id", "gameScreen" + (nbPartieInvite));

        div.innerHTML =
            "<img id=\"imageTitre\" src=\"../images/titre.png\">"+
            "<div class = \"contentGame\" id=\"contentGame"+(nbPartieInvite)+"\">" +
                "<h2>Chat partie "+partieInvite +" - <span id=\"login_p_"+(nbPartieInvite)+"\">"+currentUser+"</span></h2>" +
                "<h3>Joueurs connectés</h3>" +
                "<aside>" +
                "</aside>" +
                "<main>" +
                "</main>" +
                "<footer>" +
                    "<input type=\"text\" class =\"monMessageGame\" id=\"monMessage_p_"+(nbPartieInvite)+"\">" +
                    "<input type=\"button\" value=\"Envoyer\" class =\"btnJouerGame\" id=\"btnEnvoyer_p_"+(nbPartieInvite)+"\">" +
                    "<input type=\"button\" value=\"Image\" class =\"btnImageGame\" id=\"btnImage_p_"+(nbPartieInvite)+"\">" +
                    "<input type=\"button\" value=\"Chat\" class =\"btnChat\" id=\"btnChat_p_"+(nbPartieInvite)+"\">" +
                    "<input type=\"button\" value=\"Quitter\" class =\"btnQuitter\" id=\"btnQuitterGame_p_"+(nbPartieInvite)+"\">" +
                "</footer>" +
                "<div class =\"bcImageGame\" id=\"bcImage"+nbPartieInvite+"\" style=\"display: none;\">" +
                    "<header>" +
                        "<input type=\"text\" class=\"rechercheGame\" id=\"recherche"+(nbPartieInvite)+"\" placeholder=\"Tapez ici le texte de votre recherche\">" +
                        "<input type=\"button\" value=\"Recherche\" class=\"btnRechercherGame\" id=\"btnRechercher_p_"+(nbPartieInvite)+"\">" +
                    "</header>" +
                    "<div class =\"bcResultsGame\" id=\"bcResults"+nbPartieInvite+"\"></div>" +
                        "<footer><input type=\"button\" value=\"Fermer\" class =\"btnFermer\" id=\"btnFermer_p_"+(nbPartieInvite)+"\"></footer>" +
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

        document.getElementById("btnChat_p_" + (nbPartieInvite)).addEventListener("click", function () {
            document.getElementById("radio0").checked = true;
        });

        document.getElementById("btnEnvoyer_p_" + nbPartieInvite).addEventListener("click", envoyerMsgGame);
        document.getElementById("btnImage_p_" + nbPartieInvite).addEventListener("click", toggleImage);
        document.getElementById("btnFermer_p_" + nbPartieInvite).addEventListener("click", toggleImage);
        document.getElementById("btnRechercher_p_" + nbPartieInvite).addEventListener("click", rechercher);
        document.getElementById("bcResults" + nbPartieInvite).addEventListener("click", choixImage);
        document.getElementById("btnQuitterGame_p_" + (nbPartieInvite)).addEventListener("click", quitterGame);
        document.getElementById(id).addEventListener("click", creationFenetreJeu);
    }

    function creationTableauScore(newList, game) {

        if (game !== 0){
            document.querySelector(".gameScreen #table"+game+" tbody tr:nth-of-type(1)").innerHTML = "";
            document.querySelector(".gameScreen #table"+game+" tbody tr:nth-of-type(2)").innerHTML = "";
            console.log(newList);
            for(let i=0;i<newList.length;i++){
                let tdName = document.createElement("td");
                document.querySelector(".gameScreen #table"+game+" tbody tr:nth-of-type(1)").appendChild(tdName);
                let tdNameText;
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

    function creationFenetreJeu() {
        let partie = this.id;
        let reg = new RegExp(/[^\d]/g);
        let nb = partie;
        nb = nb.replace(reg, "");
        const res = parseInt(nb, 10);
        partie = partie.replace(/Partie .*/, "radio" + res);
        document.getElementById(partie).checked = true;
    }

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

    function rejoindrePartie() {
        let join = {
            joiner: currentUser,
            partie: partieInvite
        };
        sock.emit("joinGame", join);
        iniTabs(partieInvite);
        tabPartie.push(partieInvite);

        console.log("p_" + partieInvite);
        document.getElementById("p_" + partieInvite).removeEventListener("click", rejoindrePartie);
        document.getElementById("p_" + partieInvite).removeAttribute("id");
        //removeIDpartie();
        creationOnglet();
        fromInvit=currentUser;
    }

    function removeIDpartie(num_partie) {
        if (document.getElementById("p_" + num_partie) !== null) {
            document.getElementById("p_" + num_partie).removeEventListener("click", rejoindrePartie);
            document.getElementById("p_" + num_partie).removeAttribute("id");
        }
    }

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


        console.log(cartes);
        return cartes;
    }

    function quitterGame(id) {
        console.log("id quitterGame : "+id);
        if(partieAquitter>0){
            id=partieAquitter;
        }

        document.getElementById("radio0").checked = true;
         let res;
         let obj;
         if(id>=1) {
             res=id;
             obj={
                 joueur:currentUser,
                 cartes: getIDsCartesMain(res),
                 partieEnCours:res,
                 monTour:mon_tour[res]
             };
             console.log("id quitterGame if : "+res);
             document.querySelector("body").removeChild(document.getElementById("gameScreen"+res));
             document.getElementById("content").removeChild(document.getElementById("Partie "+res));

         }else{
             let partie = this.id;
             let reg = new RegExp(/[^\d]/g);
             let nb = partie;
             if(nb!==undefined) {
                nb = nb.replace(reg, "");
                 res = parseInt(nb, 10);
                 res = getIdInt(partie);
                 console.log("id quitterGame : " + res);
                 obj = {
                     joueur: currentUser,
                     cartes: getIDsCartesMain(res),
                     partieEnCours: res,
                     monTour: mon_tour[res]
                 };
                 partie = partie.replace(/btnQuitterGame_p_.*/, "Partie " + res);
                 document.getElementById("content").removeChild(document.getElementById(partie));
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
                 delete nbCartesChoisis[i];
                 break;
             }
         }


         document.getElementById("radio"+(res)).remove();
         sock.emit("quitGame",obj);
         partieAquitter=-1;
     }
    /**
     *  Quitter le chat et revenir à la page d'accueil.
     */
    function quitter() {
        if(tabPartie!=null) {
            for (let i = 0; i < tabPartie.length; i++) {
                quitterGame(tabPartie[i]);
            }
        }
        currentUser = null;

        sock.emit("logout");

        document.getElementById("radio-1").checked = true;
    }

    function initialiserPartie(){
        let partieLancee = getIdInt(this.id);
        document.getElementById("gameMain_p_"+partieLancee).removeChild(document.getElementById("btnLancer_p_"+partieLancee));
        sock.emit("initialiserPartie",partieLancee);
    }

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
            console.log("mise value = " + parseInt(miseValue) + " & mise actuel = " + miseActuel);
            if (parseInt(miseValue) <= miseActuel || parseInt(miseValue) === 0) {
                document.getElementById("txtMiser" + id).value = "";
                return;
            }
            /*if(miseActuel === parseInt(miseValue)){
                miseFinale=true;
            }*/

            let nbCartesSurPlateau = getNombreCartesPlateau(partieEnCours);

            if (parseInt(miseValue) <= 0 || parseInt(miseValue) > nbCartesSurPlateau) {
                document.getElementById("txtMiser" + id).value = "";
                return;
            }
            if (parseInt(miseValue) === nbCartesSurPlateau) {
                miseFinale = true;
            }

            console.log("je clique et mise : " + miseValue);
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


    function afficherPlateau(partieEnCours, cranes){
        let gameMain = document.getElementById("gameMain_p_"+partieEnCours);

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

        console.log("liste des joueurs : "+liste_joueurs[partieEnCours]);
        for(let i=0;i<liste_joueurs[partieEnCours].length; i++){
            let toDom="";
            let joueur= liste_joueurs[partieEnCours][i];
            console.log("i in listeJoueurs : "+joueur);
            toDom = document.createElement("div");
            toDom.setAttribute("class","joueur");
            toDom.setAttribute("id",joueur+"_"+partieEnCours);
            gameMain.insertBefore(toDom, document.getElementById("message"+partieEnCours));
            let main = document.createElement("main");
            let pile = document.createElement("div");


            pile.setAttribute("class","pile");
            pile.setAttribute("id","pile_"+joueur+"_"+partieEnCours);
            document.getElementById(joueur+"_"+partieEnCours).appendChild(pile);
            document.getElementById(joueur+"_"+partieEnCours).appendChild(main);


            for(let j=0;j<4;j++){
                let carte = document.createElement("div");
                carte.setAttribute("class","carte");
                carte.setAttribute("id","c_"+j+"_"+joueur+"_"+partieEnCours);
                console.log("Cranes[i] = ",cranes[i]);

                //let iconeCarte = document.createElement("p");
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
            let pseudo = document.createElement("p");
            pseudo.innerHTML = liste_joueurs[partieEnCours][i];
            pseudo.setAttribute("class","pseudo");
            document.getElementById(joueur+"_"+partieEnCours).appendChild(pseudo);

        }
        creaMiseGenerale(partieEnCours,0);
    }

    function getNombreCartesPlateau(partieEnCours){
        let nb_joueurs = liste_joueurs[partieEnCours].length;
        let nb_cartes =0;
        for(let i=0;i<nb_joueurs;i++){
            nb_cartes += document.getElementById("pile_"+liste_joueurs[partieEnCours][i]+"_"+partieEnCours).childElementCount;
        }
        return nb_cartes;
    }

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

    function seCoucher(){
        let partieEnCours = getIdInt(this.id);
        document.getElementById(this.id).disabled=true;
        let couche ={
            partieEnCours:partieEnCours,
            joueur:currentUser,
            mise:getMiseGenerale(partieEnCours)
        };


        sock.emit("seCouche",couche);
    }

    function updateMiseGenerale(partieEnCours,mise){
        let miseGenerale = document.getElementById("miseGenerale"+partieEnCours);
        miseGenerale.innerHTML = "Mise actuelle "+mise;
    }

    function enableListenerMain(partieEnCours){
        document.querySelector("#gameMain_p_"+partieEnCours+" .joueur:nth-of-type("+indices[partieEnCours]+") > main").addEventListener("click", listenerMain);

    }

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
       /* let reg = new RegExp(/[^\d]/g);
        id = id.replace(reg, "");
        const res = parseInt(id, 10);*/
        return res;
    }

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
        console.log(elt.id);
    }

    function revelerCartes(partieEnCours){
        addPileListener(partieEnCours);

    }

    function actualiserPile(partieEnCours, joueur, carte){
        let pile = document.getElementById("pile_"+joueur+"_"+partieEnCours);
        let carte_a_remove = document.getElementById(carte);
        let query = "#"+joueur+"_"+partieEnCours+" main";
        if(joueur===currentUser){
            carte_a_remove.classList.remove("retournee");
        }
        document.querySelector(query).removeChild(carte_a_remove);
        pile.appendChild(carte_a_remove);

    }
    function actualiserDefausse(partieEnCours,pileDeJoueur,carte){
        let pile = document.getElementById("pile_"+pileDeJoueur+"_"+partieEnCours);
        let defausse = document.getElementById("defausse"+partieEnCours);
        console.log("la carte : "+carte);
        let carte_a_remove = document.getElementById(carte);

        pile.removeChild(carte_a_remove);
        carte_a_remove.classList.add("selectionne");
        defausse.appendChild(carte_a_remove);
    }

    function actualiserTableau(partieEnCours, vainqueur,points){
        let tab = document.getElementById("score_"+vainqueur+"_"+partieEnCours);
        tab.innerHTML = points;

        let pile = document.getElementById("pile_"+vainqueur+"_"+partieEnCours);
        pile.classList.add("retournee");

    }

    function getPseudo(id){
        let tabz = id.split("_");
        console.log("tabz : "+tabz);
        return tabz[2];
    }

    function getNombreCartesPile(id, pseudo){
        return document.getElementById("pile_"+pseudo+"_"+id).childElementCount;
    }

    function getNombreCartesDefausse(id, pseudo){
        return document.getElementById("defausse"+id).childElementCount;
    }

    function getMiseGenerale(partieEnCours){
        let miseActuel;
        let miseActuelhtml = document.getElementById("miseGenerale"+partieEnCours).innerHTML;
        miseActuel = getIdInt(miseActuelhtml);
        return miseActuel;
    }

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

        console.log("nbCartesChoisis : "+nbCartesChoisis[partieEnCours]);
        if(nbCartesChoisis[partieEnCours]>=maxNbPile  || pileDeJoueur === currentUser) {
            nbCartesChoisis[partieEnCours]++;
            while (!elt.classList.contains("carte")) {
                elt = elt.parentElement;
            }

            if(elt.classList.contains("crane")){
                perdu=true;
                mon_tour[partieEnCours]=false;
            }

            console.log("getNbCartesDef = "+getMiseGenerale(partieEnCours));
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

            console.log("id de carte : " + id);
            /*if (!mon_tour[partieEnCours]) {
                return;
            }*/

            sock.emit("carteSelectionneePile", obj);


        }
    }

    function retirerCarte(partieEnCours, joueurAEnlever){
        let query = document.querySelector("#"+joueurAEnlever+"_"+partieEnCours+" main");
        query.addEventListener("click",retirerCarteListener);
        console.log("retirer");
    }

    function getNombreCarteMain(partieEnCours){
        return document.querySelector("#"+currentUser+"_"+partieEnCours+" main").childElementCount;
    }

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
    }

    function retirerCartePlateau(partieEnCours,joueur,carte){
        let nb_cartes_restantes = getNombreCarteMain(partieEnCours);

        let main = document.querySelector("#"+joueur+"_"+partieEnCours+" main");
        console.log("la carte : "+carte);
        let carte_a_remove = document.getElementById(carte);
        main.removeChild(carte_a_remove);

        let obj ={
            joueur:currentUser,
            partieEnCours:partieEnCours

        };
        if(joueur === currentUser && nb_cartes_restantes===1){
            sock.emit("joueurElimine", obj);
        }

    }

    function retirerCarteListener(e){
        let elt = e.target;
        let id = elt.id;
        let num_partie = getIdDoubleInt(id);
        let pseudo = getPseudo(id);
        console.log("retirer la carte : "+id);
        console.log("pseudo retirer : "+pseudo);
        console.log("num partie retirer : "+num_partie);
        let obj ={
            joueur:pseudo,
            partieEnCours:num_partie,
            carte:id
        };
        sock.emit("carteARetirer",obj);
        let query = document.querySelector("#"+pseudo+"_"+num_partie+" main");
        query.removeEventListener("click",retirerCarteListener);


    }

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

            console.log("la carte def ==>"+carte_id);

            let main = document.querySelector("#"+main_id+"_"+partieEnCours+" main");
            defausse.removeChild(defausse.firstChild);
            main.appendChild(carte);
        }

        for(let j=0;j<liste_joueurs[partieEnCours].length;j++){
            let pile = document.getElementById("pile_"+liste_joueurs[partieEnCours][j]+"_"+partieEnCours);
            if(pile!=null) {
                while (pile.firstChild) {
                    let carte = pile.firstChild;
                    let carte_id = pile.firstElementChild.id;
                    console.log("la carte pile ==>" + carte_id);
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

    function addPileListener(partieEnCours){
        maxNbPile= getNombreCartesPile(partieEnCours,currentUser);
        for(let i=0;i<liste_joueurs[partieEnCours].length;i++){
            document.getElementById("pile_"+liste_joueurs[partieEnCours][i]+"_"+partieEnCours).addEventListener("click",pileVersDefausse);
        }
    }

    function deleteJoueur(joueur,partieEnCours){
        let joueurToDelete = document.getElementById(joueur+"_"+partieEnCours);
        let gameMain = document.getElementById("gameMain_p_"+partieEnCours);
        if(joueurToDelete!=null){
            gameMain.removeChild(joueurToDelete);
        }
    }

    function disableListenerMain(partieEnCours){
        let main = document.querySelector("#gameMain_p_"+partieEnCours+" .joueur:nth-of-type("+indices[partieEnCours]+") > main");
        if(main != null){
            main.removeEventListener("click",listenerMain);
        }

    }

    function disableListenerPile(partieEnCours){
        maxNbPile=0;
        for(let i=0;i<liste_joueurs[partieEnCours].length;i++){
            document.getElementById("pile_"+liste_joueurs[partieEnCours][i]+"_"+partieEnCours).removeEventListener("click",pileVersDefausse);
        }
    }

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
    // force l'affichage de l'écran de connexion
    quitter();

});
