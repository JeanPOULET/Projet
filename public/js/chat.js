document.addEventListener("DOMContentLoaded", function(_e) {

    /*** Liste des "bugs" trouvés ***
     * Bug graphique quand suppression partie
     * Lien d'invitation bugué quand plusieurs reçus d'affilés
     * Css gameScreen fix
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
    var liste_joueurs =null;

    //indice de partie du serveur
    var partieInvite =-1;
    var fromInvit=currentUser;

    //host
    var host = null;
    
    //nombre de partie du joueur
    var nbPartie = 0;

    //tableau dans lequel le joueur fait partie
    var tabPartie=null;

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
        liste_joueurs = liste;
        if (currentUser) {
            afficherListe(liste.joueurs, liste.id_partie);
            creationTableauScore(liste.joueurs, liste.id_partie);
        }
    });

    sock.on("invitation", function (invit) {
        if (currentUser) {
            console.log("invitationneur : ", invit.from);
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

    sock.on("iniPartie",function(num_partie){
        console.log("La partie est lancée n°"+num_partie);
        afficherPlateau(num_partie);
    });

    sock.on("debutManche",function(manche){
        document.getElementById("message"+manche.num_partie).innerHTML ="Début de la manche";

        document.getElementById("message"+manche.num_partie).innerHTML ="C'est à "+manche.joueur+" de jouer !";

        jouer(manche.num_partie,1,manche.joueur);

    });

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
        if (game == 0) {
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
        if (id == undefined || id == null) {
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
        if (id == undefined || id == null || id == NaN) {
            return 0;
        }
        let reg = new RegExp(/[^\d]/g);
        id = id.replace(reg, "");
        const res = parseInt(id, 10);
        return res;
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
        for (let i in invites) {
            let id = invites[i];
            if (id != currentUser) {
                let btn = document.createElement("div");

                btn.innerHTML = "<input type='checkbox' name=\"" + id + "\" id=" + id + "><label id=\"label" + id + "\" for=" + id + ">" + id + "</label>";
                document.querySelector('#invitations').appendChild(btn);
                document.getElementById(id).addEventListener("click", function () {
                    if (document.getElementById(id).hasAttribute("checked")) {
                        metoru--;
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
        if (players[nbPartie] != undefined) {
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
            if(tabPartie===null){
                tabPartie=[];
            }
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
        partieInvite--;
    }

    /*
     * Fait apparaitre l'onglet de la fenetre de jeu
     */
    function creationOnglet() {
        var nouvelOnglet = document.createElement("h2");
        var nbPartieInvite = partieInvite; // +2 car les boutons radios vont jusqu'à 2 de base dans le chat (login et main)
        var id = "Partie " + partieInvite;
        nouvelOnglet.innerHTML = id;
        nouvelOnglet.setAttribute("id", id);
        nouvelOnglet.style.cursor = "pointer";
        var taille = 0;
        for (let i = 0; i < document.getElementById("content").children.length; i++) {
            if (document.getElementById("content").children[i].tagName == "H2") {
                taille += document.getElementById("content").children[i].offsetWidth;
            }
        }
        nouvelOnglet.style.left = "" + taille + "px";
        document.getElementById("content").insertBefore(nouvelOnglet, document.querySelector("h3"));
        var input = document.createElement("input");
        input.setAttribute("type", "radio");
        input.setAttribute("name", "btnScreen");
        input.setAttribute("id", "radio" + (nbPartieInvite));

        var div = document.createElement("div");
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
                    "<input type=\"button\" value=\"Chat\" class =\"btnChat\" id=\"btnChat_p_"+(nbPartieInvite)+"\">" +
                    "<input type=\"button\" value=\"Envoyer\" class =\"btnJouerGame\" id=\"btnEnvoyer_p_"+(nbPartieInvite)+"\">" +
                    "<input type=\"button\" value=\"Image\" class =\"btnImageGame\" id=\"btnImage_p_"+(nbPartieInvite)+"\">" +
                    "<input type=\"button\" value=\"Quitter\" class =\"btnQuitter\" id=\"btnQuitterGame_p_"+(nbPartieInvite)+"\">" +
                "</footer>" +
                "<div class =\"bcImageGame\" id=\"bcImage"+nbPartieInvite+"\" style=\"display: none;\">" +
                    "<header>" +
                        "<input type=\"text\" class=\"rechercheGame\" id=\"recherche"+(nbPartieInvite)+"\" placeholder=\"Tapez ici le texte de votre recherche\">" +
                        "<input type=\"button\" value=\"Recherche\" class=\"btnRechercherGame\" id=\"btnRechercher_p_"+(nbPartieInvite)+"\">" +
                    "</header>" +
                    "<div class =\"bcResultsGame\" id=\"bcResults"+nbPartieInvite+"\"></div>" +
                        "<footer><input type=\"button\" value=\"Fermer\" class =\"btnFermer\"id=\"btnFermer_p_"+(nbPartieInvite)+"\"></footer>" +
                    "</div>" +
                "</div>" +
                "<div class =\"gameMain\" id=\"gameMain_p_"+(nbPartieInvite)+"\">" +
                "<div class='message'  id=\"message"+nbPartieInvite+"\"> </div>"+
                "</div>" +
                "<table>"+
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
            var inputGameStart = document.createElement("input");
            inputGameStart.setAttribute("type", "button");
            inputGameStart.setAttribute("value", "Lancer la partie");
            inputGameStart.setAttribute("id", "btnLancer_p_"+nbPartieInvite);
            document.getElementById("gameMain_p_"+nbPartieInvite).appendChild(inputGameStart);
            document.getElementById("btnLancer_p_" + nbPartieInvite).addEventListener("click", initialiserPartie);
        }
        host=null;

        document.getElementById("btnChat_p_" + (nbPartieInvite)).addEventListener("click", function (e) {
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
        if (game != 0){
            document.querySelector(".gameScreen table tbody tr:nth-of-type(1)").innerHTML = "";
            document.querySelector(".gameScreen table tbody tr:nth-of-type(2)").innerHTML = "";
            console.log(newList);
            for(let i in newList){
                var tdName = document.createElement("td");
                document.querySelector(".gameScreen table tbody tr:nth-of-type(1)").appendChild(tdName);
                var tdNameText = document.createTextNode(newList[i]);
                tdName.appendChild(tdNameText);
                var tdScore = document.createElement("td");
                document.querySelector(".gameScreen table tbody tr:nth-of-type(2)").appendChild(tdScore);
                var tdScoreText = document.createTextNode("0");
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

    function rejoindrePartie() {
        let join = {
            joiner: currentUser,
            partie: partieInvite
        };
        sock.emit("joinGame", join);


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

    function quitterGame(id) {
        console.log("id quitterGame : "+id);
        document.getElementById("radio0").checked = true;
         let res;
         if(id>=1) {
             res=id;
             document.querySelector("body").removeChild(document.getElementById("gameScreen"+res));
             document.getElementById("content").removeChild(document.getElementById("Partie "+res));

         }else{
             let partie = this.id;
             let reg = new RegExp(/[^\d]/g);
             let nb = partie;
             nb = nb.replace(reg, "");
             res = parseInt(nb, 10);
             partie = partie.replace(/btnQuitterGame_p_.*/, "Partie " + res);
             document.getElementById("content").removeChild(document.getElementById(partie));
             partie = partie.replace(/Partie .*/, "gameScreen" + (res ));
             document.querySelector("body").removeChild(document.getElementById(partie));

         }
         for(let i in tabPartie){
             if(tabPartie[i]===res){
                 delete tabPartie[i];
                 break;
             }
         }
         document.getElementById("radio"+(res)).remove();
         sock.emit("quitGame",res);
     }
    /**
     *  Quitter le chat et revenir à la page d'accueil.
     */
    function quitter() {
        for(let i in tabPartie){
            console.log("du coup si");
            quitterGame(tabPartie[i]);
        }
        currentUser = null;

        sock.emit("logout");

        document.getElementById("radio-1").checked = true;
    }

    function initialiserPartie(){
        let partieLancee = getIdInt(this.id);
        document.getElementById("gameMain_p_"+partieLancee).removeChild(document.getElementById("btnLancer_p_"+partieLancee));
        sock.emit("initialiserPartie",partieLancee);
        jouer(partieLancee,0);
    }

    function afficherPlateau(partieEnCours){
        var gameMain = document.getElementById("gameMain_p_"+partieEnCours);
        var toDom="";
        console.log("liste des joueurs : "+liste_joueurs.joueurs);
        for(let i in liste_joueurs.joueurs){
            console.log("i in listeJoueurs : "+liste_joueurs.joueurs[i]);
            toDom= document.createElement("div");
            toDom.setAttribute("class","joueur");
            toDom.setAttribute("id",liste_joueurs.joueurs[i]+"_"+partieEnCours);
            gameMain.appendChild(toDom);
            let main = document.createElement("main");
            document.getElementById(liste_joueurs.joueurs[i]+"_"+partieEnCours).appendChild(main);
            for(let j=0;j<4;j++){
                let carte = document.createElement("div");
                carte.setAttribute("class","carte");
                switch(i){
                    case '0':
                        carte.classList.add("amazons");
                        break;
                    case '1' :
                        carte.classList.add("carnivorous");
                        break;
                    case '2':
                        carte.classList.add("cyborgs");
                        break;
                    case '3':
                        carte.classList.add("indians");
                        break;
                    case '4':
                        carte.classList.add("jokers");
                        break;
                    case '5':
                        carte.classList.add("swallows");
                        break;
                }
                document.querySelector("#"+liste_joueurs.joueurs[i]+"_"+partieEnCours+" main").appendChild(carte);
            }
        }



    }

    function lancerPartie(partieLancee){
        console.log("liste des joueurs pour partie n°"+partieLancee+" :: "+ players_liste.joueurs);
    }

    function jouer(partieLancee, etat,joueur){
        if(joueur!=currentUser) {
            switch (etat) {
                case 1 :
                case 2 :
                case 3 :
                case 4 :
                case 5 :
            }
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
