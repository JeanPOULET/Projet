document.addEventListener("DOMContentLoaded", function(_e) {

    /*
     * Bug graphique quand suppression partie
     * Lien d'invitation bugué
     * Css gameScreen fix
     *lololol
    */

    // socket ouverte vers le client
    var sock = io.connect();
    
    // utilisateur courant 
    var currentUser = null;

    //liste des users
    var users =null;

    //liste des joueurs
    var players = [[]];

    //indice de partie du serveur
    var partieInvite =-1;
    var fromInvit=currentUser;
    //nombre de partie du joueur
    var nbPartie = 0;

    // on attache les événements que si le client est connecté.
    sock.on("bienvenue", function(id) {
        if (currentUser) {
            document.querySelector("#content main").innerHTML = "";
            document.getElementById("monMessage").value = "";
            document.getElementById("login").innerHTML = id;
            document.getElementById("radio2").checked = true;
            currentUser = id;
            fromInvit=currentUser;
        }
    });
    sock.on("message", function(msg) {
        if (currentUser) {
            afficherMessage(msg);
        }
    });
    sock.on("liste", function(liste) {
        users =liste;
        if (currentUser) {
            afficherListe(liste);
        }
    });

    sock.on("invitation",function(invit){
        if(currentUser){
            partieInvite = invit.partie;
            if(invit.from !=null) {
                fromInvit = invit.from;
            }
        }

    });

    /**
     *  Connexion de l'utilisateur au chat.
     */
    function connect() {

        // recupération du pseudo
        var user = document.getElementById("pseudo").value.trim();
        if (! user) return;
        document.getElementById("radio2").check = true;
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
        var bcMessages = document.querySelector("#content main");

        var classe = "";

        if (data.from === currentUser) {
            classe = "moi";
        }
        else if (data.from == null) {
            classe = "system";
        }

        if (data.to != null) {
            classe = classe || "mp";
            data.from += " (à " + data.to + ")";
        }

        var date = new Date(data.date);
        date = date.toISOString().substr(11,8);
        if (data.from == null) {
            data.from = "[admin]";
        }

        data.text = traiterTexte(data.text);

        bcMessages.innerHTML += "<p class='" + classe + "'>" + date + " - " + data.from + " : " + data.text + "</p>";

        document.querySelector("main > p:last-child").scrollIntoView();
        if(partieInvite >0 && fromInvit!==currentUser){
            document.getElementById("p_"+partieInvite).addEventListener("click",rejoindrePartie);

        }

    }

    // traitement des emojis
    function traiterTexte(txt) {
        var ind = txt.indexOf("[img:");
        while (ind >= 0) {
            txt = txt.replace("\[img:",'<img src="');
            txt = txt.replace('\]','">');
            ind = txt.indexOf("[img:");
        }
        txt = txt.replace(/:[-]?\)/g,'<span class="emoji sourire"></span>');
        txt = txt.replace(/:[-]?D/g,'<span class="emoji banane"></span>');
        txt = txt.replace(/:[-]?[oO]/g,'<span class="emoji grrr"></span>');
        txt = txt.replace(/<3/g,'<span class="emoji love"></span>');
        txt = txt.replace(/:[-]?[Ss]/g,'<span class="emoji malade"></span>');
        return txt;
    }



    function afficherListe(newList) {
        document.querySelector("#content aside").innerHTML = newList.join("<br>");
    }


    /**
     *  Envoyer un message
     */
    function envoyer() {

        var msg = document.getElementById("monMessage").value.trim();
        if (!msg) return;

        // message privé
        var to = null;
        if (msg.startsWith("@")) {
            var i = msg.indexOf(" ");
            to = msg.substring(1, i);
            msg = msg.substring(i);
        }
        // envoi
        sock.emit("message", { from: currentUser, to: to, text: msg });

        document.getElementById("monMessage").value = "";
    }

    /**
     *  Fermer la zone de choix d'une image
     */
    function toggleImage() {
        if (document.getElementById("bcImage").style.display === "none") {
            document.getElementById("bcImage").style.display = "block";
            document.getElementById("recherche").focus();
        }
        else {
            document.getElementById("bcImage").style.display = "none";
            document.getElementById("recherche").value = "";
            document.getElementById("bcResults").innerHTML = "";
        }
    }

    /**
     *  Recherche d'une image
     */
    function rechercher(e) {
        var queryString = document.getElementById("recherche").value;
        queryString = queryString.replace(/\s/g,'+');
        // appel AJAX
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function(_e) {
            if (this.readyState === XMLHttpRequest.DONE) {
                if (this.status === 200) {
                    var data = JSON.parse(this.responseText).data;
                    var html = "";
                    for (var i in data) {
                        var url = data[i].images.fixed_height.url;
                        html += "<img src='"+url+"'>";
                    }
                    document.getElementById("bcResults").innerHTML = html;
                }
            }
        };
        xhttp.open('GET', 'http://api.giphy.com/v1/gifs/search?q=' + queryString + '&limit=20&api_key=0X5obvHJHTxBVi92jfblPqrFbwtf1xig', true);
        xhttp.send(null);
    }


    function choixImage(e) {
        if (e.target instanceof HTMLImageElement) {
            sock.emit("message", {from: currentUser, to: null, text: "[img:" + e.target.src + "]"});
            toggleImage();
        }

    }


    /**
     * Permet de séléctionné les membres que l'on veut inviter dans une partie
     */
    function fenetreInvitation(){
        var metoru = 0;
        document.querySelector('#invitations').innerHTML = "";
        var invites = users;
        for(let i in invites){
            let id = invites[i];
            if(id!=currentUser){
                let btn = document.createElement("div");

                btn.innerHTML = "<input type='checkbox' name=\""+id+"\" id="+id+"><label id=\"label"+id+"\" for="+id+">"+id+"</label>";
                document.querySelector('#invitations').appendChild(btn);
                document.getElementById(id).addEventListener("click", function(){
                    if(document.getElementById(id).hasAttribute("checked")){
                        metoru--;
                        document.getElementById("label"+id).style.backgroundColor = "initial";
                        document.getElementById(id).removeAttribute("checked");
                        players[nbPartie].splice(players[nbPartie].indexOf(id),1);
                    }else{
                        if(metoru >= 5){
                            alert("Pas plus de 5 à la fois guignol");
                            document.getElementById(id).removeAttribute("checked");
                            document.getElementById("label"+id).style.backgroundColor = "initial";
                        }else{
                            document.getElementById(id).setAttribute("checked", "checked");
                            document.getElementById("label"+id).style.backgroundColor = "yellow";
                            document.getElementById("label"+id).style.transitionDuration = "0.5s";
                            metoru++;
                            if(players[nbPartie] ===undefined) {
                                players[nbPartie] = [];
                            }
                            players[nbPartie].push(id);
                        }
                    }
                });
            }
            document.getElementById("fenetreInvit").style.display="block";
        }
        sock.emit("invitation",null);
    }

    /**
     * Envoie les invitations aux membres séléctionnés
     */
    function invitation(){
        if(players[nbPartie] != undefined) {
            document.getElementById("fenetreInvit").style.display = "none";
            let invitation ={
                to:players[nbPartie],
                from: currentUser,
                partie : partieInvite
            };
            sock.emit("invitation",invitation);
            for (let i in players[nbPartie]) {
                let invit = {
                    from: currentUser,
                    to: players[nbPartie][i],
                    text: "<a id=\"p_"+partieInvite+"\">Clique pour rejoindre mon invitation</a>",
                    date: Date.now()
                };

                sock.emit("message", invit);
            }
            let join={
                joiner: currentUser,
                partie: partieInvite
            };


            sock.emit("joinGame",join);
            nbPartie++;
            creationOnglet();
        }
    }

    /*
     * Quitte la fenetre d'invitation
     */

    function annulerInvit(){
        document.getElementById("fenetreInvit").style.display="none";
        partieInvite--;
    }

    /*
     * Fait apparaitre l'onglet de la fenetre de jeu
     */
    function creationOnglet(){
        if(partieInvite == -1){
            partieInvite = 2;
        }
        partieInvite++;
        var nouvelOnglet = document.createElement("h2");
        var id = "Partie "+partieInvite;
        nouvelOnglet.innerHTML = id;
        nouvelOnglet.setAttribute("id", id);
        var taille = 0;
        for (let i = 0; i < document.getElementById("content").children.length; i++) {
            if(document.getElementById("content").children[i].tagName == "H2"){
                taille += document.getElementById("content").children[i].offsetWidth;
            }
        }
        nouvelOnglet.style.left = ""+taille+"px";
        document.getElementById("content").insertBefore(nouvelOnglet, document.querySelector("h3"));
        var input = document.createElement("input");
        input.setAttribute("type", "radio");
        input.setAttribute("name", "btnScreen");
        input.setAttribute("id", "radio"+partieInvite);

        var div = document.createElement("div");
        div.setAttribute("id", "gameScreen"+partieInvite);

        div.innerHTML =
            "<div class = \"contentGame\" id=\"contentGame"+partieInvite+"\">" +
                "<h2>Chat du jeu - <span id=\"login_p_"+partieInvite+"\"></span></h2>" +
                "<h3>Joueurs connectés</h3>" +
                "<aside>" +
                "</aside>" +
                "<main>" +
                "</main>" +
                "<footer>" +
                    "<input type=\"text\" class =\"monMessageGame\" id=\"monMessage_p_"+partieInvite+"\">" +
                    "<input type=\"button\" value=\"Chat\" class =\"btnChat\" id=\"btnChat_p_"+partieInvite+"\">" +
                    "<input type=\"button\" value=\"Envoyer\" class =\"btnJouerGame\" id=\"btnEnvoyer_p_"+partieInvite+"\">" +
                    "<input type=\"button\" value=\"Image\" class =\"btnImageGame\" id=\"btnImage_p_"+partieInvite+"\">" +
                    "<input type=\"button\" value=\"Quitter\" class =\"btnQuitter\" id=\"btnQuitterGame_p_"+partieInvite+"\">" +
                "</footer>" +
                "<div class =\"bcImageGame\" id=\"bcImage\" style=\"display: none;\">" +
                    "<header>" +
                        "<input type=\"text\" class=\"rechercheGame\" id=\"recherche\" placeholder=\"Tapez ici le texte de votre recherche\">" +
                        "<input type=\"button\" value=\"Recherche\" class=\"btnRechercherGame\" id=\"btnRechercher_p_"+partieInvite+"\">" +
                    "</header>" +
                    "<div class =\"bcResultsGame\" id=\"bcResults_p_"+partieInvite+"\">></div>" +
                        "<footer><input type=\"button\" value=\"Fermer\" class =\"btnFermer\"id=\"btnFermer_p_"+partieInvite+"\"></footer>" +
                    "</div>" +
                "</div>" +
                "<div class =\"gameMain\" id=\"gameMain_p_"+partieInvite+"\">" +
                    "<p> Ceci est un jeu</p>" +
                    "<input type=\"button\" value=\"Lancer la partie\" id=\"btnLancer_p_"+partieInvite+"\">" +
                "</div>" +
            "</div>";

        document.querySelector("body").appendChild(input);
        document.querySelector("body").appendChild(div);

        document.getElementById("btnChat_p_"+partieInvite).addEventListener("click", function(e){
            document.getElementById("radio2").checked = true;
        });

        document.getElementById("btnQuitterGame_p_"+partieInvite).addEventListener("click", function(e){
            document.getElementById("radio2").checked = true;
            let partie =  this.id;
            let reg = new RegExp(/[^\d]/g);
            let nb =partie;
            nb = nb.replace(reg,"");
            const res=parseInt(nb,10);
            partie = partie.replace(/btnQuitterGame_p_.*/ ,"Partie "+res);
            document.getElementById("content").removeChild(document.getElementById(partie));
            partie = partie.replace(/Partie .*/ ,"gameScreen"+res);
            document.querySelector("body").removeChild(document.getElementById(partie));
        });
        document.getElementById(id).addEventListener("click", creationFenetreJeu);
    }

    function creationFenetreJeu(){
        let partie =  this.id;
        let reg = new RegExp(/[^\d]/g);
        let nb =partie;
        nb = nb.replace(reg,"");
        const res=parseInt(nb,10);
        partie = partie.replace(/Partie .*/ ,"radio"+res);
        document.getElementById(partie).checked = true;
    }

     function rejoindrePartie(){
         let join ={
           joiner: currentUser,
           partie: partieInvite
         };
         sock.emit("joinGame",join);
         document.getElementById("_p"+partieInvite).removeEventListener("click",rejoindrePartie);
         creationOnglet();
     }

    /**
     *  Quitter le chat et revenir à la page d'accueil.
     */
    function quitter() {
        currentUser = null;
        sock.emit("logout");
        document.getElementById("radio1").checked = true;
    };

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
