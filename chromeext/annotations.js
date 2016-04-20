//This file adds jump-to-def links in GitHub files
(function(){

	var consumingSpan, annotating; 

	function checkFile(document){
		if (document.getElementsByClassName("file").length!==0){
			main();
		}
		else {
			setTimeout(function(){
				checkFile(document);
			}, 200)		
		}
	}
	if (document.URL.split("/")[5] === "blob"){
		checkFile(document);	
	}

	document.addEventListener("DOMContentLoaded", function() {
		amplitude.init('f7491eae081c8c94baf15838b0166c63')
		var pageScript = document.createElement("script");
		pageScript.innerHTML = "$(document).on('pjax:success', function () { var evt = new Event('PJAX_PUSH_STATE_0923'); document.dispatchEvent(evt); });";
		document.querySelector("body").appendChild(pageScript);
		var mainCallOnce = debounce(mainCall);

		document.addEventListener("PJAX_PUSH_STATE_0923", mainCallOnce);
	})

	function main() {
		mainCall();
	}

	function mainCall() {
		var fileElem = document.querySelector(".file .blob-wrapper");
		var lang;
		if (fileElem){
			document.addEventListener("click", function(e){
				if (e.target.className === "sgdef") {
					amplitude.logEvent("JumpToDefinition");
				}
			})
			var finalPath = document.getElementsByClassName("final-path")[0].innerText.split(".");
			lang = finalPath[finalPath.length-1];
			if (lang.toLowerCase() === "go") {
				if (document.getElementsByClassName("vis-private").length !==0){
					getAuthToken();
				}
				else{
					checkLatestCommit();
				}
			}
		}
	}

	function getAuthToken(){
		if (document.getElementsByClassName("vis-private").length !==0){
			$.ajax ({
				method:"GET",
				url: "https://sourcegraph.com"
			}).done(authHandler)
		}
	}


	function authHandler(data) {
		var doc = (new DOMParser()).parseFromString(data,"text/xml");
		var token = ("x-oauth-basic:"+doc.getElementsByTagName("head")[0].getAttribute("data-current-user-oauth2-access-token"));

		checkLatestCommit(token)
	}

	function checkLatestCommit(token){
		var urlsplit = document.URL.split("/")
		var user = urlsplit[3]
		var repo = urlsplit[4]
		var branch = "master"
		if (urlsplit[6] !== null && (urlsplit[5]==="tree" || urlsplit[5]==="blob")) {
			branch = urlsplit[6];
		}
		var path = urlsplit[7];
		if (urlsplit.length > 8){
			for (var i = 8; i < urlsplit.length; i++){
				path = path + "/" + urlsplit[i] 
			}
		}

		var commitID;
		if (document.getElementsByClassName("file").length !== 0) {
			commitID =document.getElementsByClassName("js-permalink-shortcut")[0].href.split("/")[6];
		}
		var checkCommit = $.ajax ({
			dataType: "json",
			method: "GET",	
			url: "https://sourcegraph.com/.api/repos/github.com/"+user+"/"+repo+"@"+branch+"==="+commitID+"/-/srclib-data-version?Path="+path,
			headers: {
				"authorization": "Basic " + window.btoa(token)
			}
		}).done(getAnnotations(token, commitID, user, repo, branch, path));
		checkCommit.fail(function(){
			return;
		})
	}

	function getAnnotations(token, commitID, user, repo, branch, path) {
		$.ajax ({
			dataType: "json",
			method: "GET",
			url: "https://sourcegraph.com/.api/annotations?Entry.RepoRev.URI=github.com/"+user+"/"+repo+"&Entry.RepoRev.Rev="+branch+"&Entry.RepoRev.CommitID="+commitID+"&Entry.Path="+path+"&Range.StartByte=0&Range.EndByte=0",
			headers: {
				"authorization": "Basic " + window.btoa(token)
			}
		}).done(getSourcegraphRefLinks)
	}

	//Here we are assuming no overlapping annotations.
	function getSourcegraphRefLinks(data) {
		var annsByStartByte = {};
		var annsByEndByte = {};
		for (var i = 0; i < data.Annotations.length; i++){
			if (data.Annotations[i].URL !== undefined) {
				var ann = data.Annotations[i];
				annsByStartByte[ann.StartByte] = ann;
				annsByEndByte[ann.EndByte] = ann;
			}
		}
		traverseDOM(annsByStartByte, annsByEndByte);
	}


	function traverseDOM(annsByStartByte, annsByEndByte){
		var table = document.querySelector("table");
		var count = 0;
		
		//get output HTML for each line and replace the original <td>
		for (var i = 0; i < table.rows.length; i++){
			var output = "";
			var row = table.rows[i];

			
			// Code is always the second <td> element.  We want to replace code.innerhtml.
			var code = row.cells[1]
			var children = code.childNodes; 
			var startByte = count;
			count += utf8.encode(code.textContent).length;
			if (code.textContent !== "\n") {
				count++; // newline
			}
			//Go through each childNode
			for (var j = 0; j < children.length; j++) {

				var childNodeChars;

				if (children[j].nodeType === Node.TEXT_NODE){
					childNodeChars = children[j].nodeValue.split("")
				}
				
				else {
					childNodeChars = children[j].outerHTML.split("");    
				}

				//when we are returning the <span> element, we don"t want to increment startByte
				consumingSpan = false;
				//keep track of whether we are currently on a definition with a link
				annotating = false;

				//go through each char of childNodes
				for (var k = 0; k < childNodeChars.length; k++) {
					if (childNodeChars[k] === "<" && childNodeChars[k+1] !== " ") {
						consumingSpan = true;
					}

					if (!consumingSpan){
						output += next(childNodeChars[k], startByte, annsByStartByte, annsByEndByte)
						startByte += utf8.encode(childNodeChars[k]).length  
					}
					else {
						output += childNodeChars[k]
					}

					if (childNodeChars[k] === ">") {            		
						consumingSpan = false;
					}
				}
			}

			replace(code,output)
			
		}
		if (document.getElementsByClassName("sourcegraph-popover visible").length !== 0){
			document.getElementsByClassName("sourcegraph-popover visible")[0].classList.remove("visible")
		}
	}

	function replace(code, output){
		setTimeout(function(){
			code.innerHTML = output;
			defPopovers(code)
		})
	}

	function defPopovers(code) {
		var newRows = code.childNodes
		for (var n = 0; n < newRows.length; n++){
			sourcegraph_activateDefnPopovers(newRows[n])

		}
	}
	function next(c, byteCount, annsByStartByte, annsByEndByte) {
		//console.log("byteCount", byteCount, c);

		var matchDetails = annsByStartByte[byteCount];
		
		//if there is a match
		if (annotating===false && matchDetails !== undefined) { 
			if (annsByStartByte[byteCount].EndByte - annsByStartByte[byteCount].StartByte === 1){
				return "<a href='https://sourcegraph.com"+matchDetails.URL+"?utm_source=chromeext&utm_medium=chromeext&utm_campaign=chromeext' target='tab' class='sgdef'>"+c+"</a>"
			}
			
			annotating = true;
			return "<a href='https://sourcegraph.com"+matchDetails.URL+"?utm_source=chromeext&utm_medium=chromeext&utm_campaign=chromeext' target='tab' class='sgdef'>"+c
		}

		//if we reach the end of the child node - our counter = endByte of the match, annotating = false, close the tag.  
		if (annotating===true && annsByEndByte[byteCount+1]) {
			annotating = false;
			return c+"</a>"
		}
		
		else {

			return c

		}


	}

}());