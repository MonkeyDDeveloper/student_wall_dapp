import { canisterId, createActor } from "../../declarations/StudentWall_backend";
import { HttpAgent } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";

function renderSendMessagesForm() {
  let clone = document.importNode(sendMessageFormTemplate.content, true);
  sendMessageFormContainer.appendChild(clone);
  let sendMessageForm = document.getElementById('sendMessageForm');
  sendMessageForm.onsubmit = writeNewMessage;
  sendMessageForm.querySelector('#file').onchange = validateFile;
  sendMessageForm.querySelector('#deleteFile').onclick = () => {
    document.getElementById('file').value = null;
    document.getElementById('fileNameDisplay').innerText = "";
    document.getElementById('withFile').value = "false"
  };
}


function renderLoginForm() {
  notLoggedMessageContainer.innerHTML = notLoggedMessage;
  buttonToLoginContainer.innerHTML = buttonToLogin;
  userName.style.display = "block";
}

function setUserNameForSession() {
  localStorage.userName = userName.value;
}

function quitLoginForm() {
  notLoggedMessageContainer.innerHTML = "";
  buttonToLoginContainer.innerHTML = "";
  buttonToLogoutContainer.innerHTML = buttonToLogout;
  userName.style.display = "none";
}

async function getAllMessages() {
  let allMessages = await studentWallBackend.getAllMessages();
  allMessages.sort((message1, message2) => Number(message2.id) - Number(message1.id));
  return allMessages
}

async function validateFile() {
  let fileInput = document.getElementById('file');
  let file = fileInput.files[0];
  let fileName = file.name;

  document.getElementById('withFile').value = "false"
  
  if (!file) {
    console.log('Please select a file.');
    return {
      empty: true,
      oversize: null,
      blob: null,
      type: null
    };
  }
  
  let fileSize = file.size / 1024; // Size in kilobytes
  let fileType = file.type;
  let isImage = fileType.startsWith('image/')
  let isVideo = fileType.startsWith('video/')
  
  if (
    !(isImage) ||
    fileSize > 1024
  ) {
    console.log('The file must be a photo with a maximum size of 1MB.');
    return {
      oversize: true,
      empty: null,
      blob: null,
      type: null
    };
  }
  
  let blob = await new Promise((res, rej) => {
    let reader = new FileReader();
    reader.onload = function() {
      // let blob = new Blob([reader.result], { type: fileType });
      let unitArr8 = new Uint8Array(reader.result)
      document.getElementById('fileNameDisplay').innerText = file.name;
      document.getElementById('withFile').value = "true"
      // Perform necessary actions with the Blob object
      console.log('Valid file as Blob:', unitArr8);
      res(unitArr8)
    };
    reader.readAsArrayBuffer(file);
  })

  return {
    blob,
    empty: null,
    oversize: null,
    fileName,
    type: isImage ? 'Image' : 'Video'
  };
}

async function writeNewMessage(e) {

  e.preventDefault()

  console.log(e.target.querySelector("#messageToEditId").value)

  let {empty, oversize, blob, type, fileName} = await validateFile();

  if (oversize) {

    alert('The file must be a photo with a maximum size of 1MB.');
    return
  
  }

  let content = {}

  if (empty) {
    content = { Text: e.target.querySelector("textarea").value }
  }
  else {
    content[type] = {
      text: e.target.querySelector("textarea").value,
      file: blob,
      fileName,
    }
  }

  let message = {
    id: Number(e.target.querySelector("#messageToEditId").value),
    withFile: e.target.querySelector("#withFile").value === 'true' ? true : false,
    userName: localStorage.userName,
    creator: authClient.getIdentity(),
    vote: 0,
    content
  }

  if (Number.isNaN(message.id)) {

    console.log('writing message')

    e.target.querySelector(".submitButton").innerHTML = spinner;
    e.target.querySelector(".submitButton").style.disabled = true;

    await studentWallBackend.writeMessage(message.content, message.userName);

    await updateMessagesInDom()

    e.target.querySelector("textarea").value = ""
    document.getElementById('file').value = null
    document.getElementById('fileNameDisplay').innerText = "";
    e.target.querySelector(".submitButton").innerHTML = "";
    e.target.querySelector(".submitButton").innerText = "Send message";
    e.target.querySelector(".submitButton").style.disabled = false;

    return

  }

  e.target.querySelector(".submitButton").innerHTML = spinner;
  e.target.querySelector(".submitButton").style.disabled = true;
  e.target.querySelector(".cancelButton").innerHTML = spinnerDanger;
  e.target.querySelector(".cancelButton").style.disabled = true;

  await studentWallBackend.updateMessage(message.id, message.content, message.withFile);

  await updateMessagesInDom()

  e.target.querySelector("textarea").value = ""
  document.getElementById('file').value = null
  document.getElementById('fileNameDisplay').innerText = blob.name;
  e.target.querySelector(".submitButton").innerHTML = "";
  e.target.querySelector(".submitButton").style.disabled = false;
  e.target.querySelector(".cancelButton").innerHTML = "Cancel";
  e.target.querySelector(".cancelButton").style.disabled = false;
  
  cancelEditForm()

}

async function deleteMessage(e, messageId) {
  e.preventDefault()

  e.target.innerHTML = smallSpinnerDanger;
  e.target.style.disabled = true;

  await studentWallBackend.deleteMessage(messageId);
  await updateMessagesInDom()

  // e.target.removeChild(smallSpinnerDanger);
  // e.target.style.disabled = false;

  // window.location.reload()
}

function cancelEditForm() {

  let sendMessageForm = document.getElementById('sendMessageForm');

  sendMessageForm.querySelector('.submitButton').innerText = "Send message"

  sendMessageForm.querySelector('.cancelButton').style.display = "none"

  sendMessageForm.querySelector('#messageToEditId').value = "null"

  sendMessageForm.querySelector('#withFile').value = "false"

  sendMessageForm.querySelector("textarea").value = ""

}

async function setEditForm(messageId, content) {

  let sendMessageForm = document.getElementById('sendMessageForm');
  let contentType = Object.keys(content)[0]

  sendMessageForm.querySelector('.submitButton').innerText = "Edit message"

  sendMessageForm.querySelector('.cancelButton').style.display = "block"
  sendMessageForm.querySelector('.cancelButton').onclick = cancelEditForm

  sendMessageForm.querySelector('#messageToEditId').value = messageId
  sendMessageForm.querySelector('#withFile').value = contentType != 'Text' ? "true" : "false"
  sendMessageForm.querySelector("textarea").value = contentType != 'Text' ? content[contentType].text : content.Text
  sendMessageForm.querySelector("#fileNameDisplay").innerText = contentType != 'Text' ? content[contentType].fileName  : ''
  // sendMessageForm.querySelector("#file").dataset.blob = contentType != 'Text' ? URL.createObjectURL(content[contentType].blob) : ''

  const windowHeight = window.innerHeight;
  const scrollPosition = (windowHeight - sendMessageForm.offsetHeight) / 2;

  sendMessageForm.focus()
  window.scrollTo(0, scrollPosition);

}

async function voteMessage(e, voted, messageId) {

  e.target.innerHTML = smallSpinner;
  e.target.style.disabled = true;

  if (voted) {

    await studentWallBackend.downVote(messageId)
    await updateMessagesInDom()
    return

  }

  await studentWallBackend.upVote(messageId)
  await updateMessagesInDom()

}

async function renderMessages(messages) {
  const fragment = document.createDocumentFragment();
  messagesContainer.innerHTML = "";

  let gettingLastUpdatesTitle = document.createElement('h3')
  gettingLastUpdatesTitle.className = "col-7 bg-dark mb-2 text-white text-start font-rubik"
  gettingLastUpdatesTitle.innerText = "Getting last updates..."

  if(messagesContainerTitle.childElementCount > 0) messagesContainerTitle.removeChild(messagesContainerTitle.firstElementChild)
  messagesContainerTitle.appendChild(gettingLastUpdatesTitle)

  for(let message of messages) {
    let clone = document.importNode(messageTemplate.content, true);

    let voted = message.voteBy.includes(localStorage.idSession)
    let contentType = Object.keys(message.content)[0]
    let videoHtml = document.createElement('video')
        videoHtml.className = "videoHtml"
        videoHtml.controls = true
    let sourceElement = document.createElement('source');
        sourceElement.type = "video/mp4"
    let imageHtml = document.createElement('img')
        imageHtml.classList.add('imageHtml')
        imageHtml.classList.add('img-fluid')
    // let identity = authClient

    clone.querySelector(".userName").innerText = message.userName;
    clone.querySelector(".content").innerText = contentType != 'Text' ? message.content[contentType].text : message.content.Text;
    clone.querySelector(".creator").innerText = message.creator;
    clone.querySelector(".vote").innerText = message.vote;
    clone.querySelector(".deleteButton").dataset.messageId = message.id;
    clone.querySelector(".deleteButton").onclick = (e) => deleteMessage(e, message.id);
    clone.querySelector(".editButton").dataset.messageId = message.id;
    clone.querySelector(".editButton").onclick = (e) => setEditForm(message.id, message.content);
    clone.querySelector(".voteButton").dataset.messageId = message.id;
    clone.querySelector(".voteButton").onclick = (e) => voteMessage(e, voted, message.id);
    clone.querySelector(".voteButton").dataset.voted = "false"
    clone.querySelector(".voteButton").querySelector('.votedIcon').style.display = "none"
    clone.querySelector(".voteButton").querySelector('.noVotedIcon').style.display = "inline"

    if(contentType != 'Text') {

      let typeInLowerCase = contentType.toLowerCase()

      console.log({message})
      console.log({content: message.content})
      console.log(typeof message.content[contentType].file)

      clone.querySelector(`.${typeInLowerCase}Container`).style.display = "block"

      let fileReader = new FileReader();

      let dataUrl = await new Promise((res, rej) => {

        fileReader.onload = (event) => {
          let dataURL = event.target.result;
          res(dataURL)
        };

        if(typeInLowerCase == 'video') {

          let videoBlob = new Blob([message.content[contentType].file], { type: 'video/mp4' });
          res(URL.createObjectURL(videoBlob))
          return

        }
  
        fileReader.readAsDataURL(new Blob([message.content[contentType].file]));

      })

      typeInLowerCase == 'video' ? sourceElement.src = dataUrl : imageHtml.src = dataUrl
      typeInLowerCase == 'video' ? videoHtml.appendChild(sourceElement) : {}

      clone.querySelector(`.${typeInLowerCase}Container`).appendChild(typeInLowerCase == 'video' ? videoHtml : imageHtml)

    }

    if (message.creator != localStorage.idSession) {
      clone.querySelector(".deleteButton").style.display = "none"
      clone.querySelector(".editButton").style.display = "none"
    }

    if (message.voteBy.includes(localStorage.idSession)) {
      clone.querySelector(".voteButton").querySelector('.votedIcon').style.display = "inline"
      clone.querySelector(".voteButton").querySelector('.noVotedIcon').style.display = "none"
    }

    fragment.appendChild(clone);
  };

  let lastUpdatesTitle = document.createElement('h3')
  lastUpdatesTitle.className = "col-7 bg-dark mb-2 text-white text-start font-rubik"
  lastUpdatesTitle.innerText = "Last updates"

  messagesContainerTitle.removeChild(messagesContainerTitle.firstElementChild)
  messagesContainerTitle.appendChild(lastUpdatesTitle)
  messagesContainer.appendChild(fragment);
}

async function updateMessagesInDom() {

  let messages = await getAllMessages()

  renderMessages(messages)

}

async function login(e) {

  e.preventDefault()

  authClient.login({
    onSuccess: async () => {

      let identity = authClient.getIdentity()

      studentWallBackend = createActor(canisterId, { agent: new HttpAgent({ identity }) })

      localStorage.idSession = await studentWallBackend.whoami()

      renderSendMessagesForm();

      setUserNameForSession()

      quitLoginForm()

      console.log({ identity })

      await updateMessagesInDom()
    },
    onError: (err) => {
      console.error(err);
      alert(`No se pudo iniciar sesión: ${err.message}`);
    },
  })

}

async function logout(e) {

  e.preventDefault()

  authClient.logout()

  window.location.reload()

}

const sendMessageFormTemplate = document.getElementById("sendMessageFormTemplate");
const messageTemplate = document.getElementById("messageTemplate");
const messagesContainer = document.getElementById("messagesContainer");
const messagesContainerTitle = document.getElementById("messagesContainerTitle");
const sendMessageFormContainer = document.getElementById("sendMessageFormContainer");
const loginForm = document.getElementById("loginForm");
const userName = document.getElementById("userName");
const logoutForm = document.getElementById("logoutForm");
const notLoggedMessageContainer = document.getElementById("notLoggedMessageContainer");
const buttonToLoginContainer = document.getElementById("buttonToLoginContainer");
const buttonToLogoutContainer = document.getElementById("buttonToLogoutContainer");

const notLoggedMessage = '<p class="text-white text-center font-rubik">It seems you arent logged in, you have to do it to write updates for your team</p>'
const buttonToLogin = '<button class="btn btn-outline-info w-100" type="submit" title="login with the power of internet identity">Login with internet identity</button>'
const buttonToLogout = '<button class="btn btn-outline-info w-100" type="submit" title="log out">Log out</button>'
const spinner = '<div class="spinner-border text-info" role="status"><span class="sr-only"></span></div>'
const spinnerDanger = '<div class="spinner-border text-danger" role="status"><span class="sr-only"></span></div>'
const smallSpinner = '<div class="spinner-border text-info spinner-border-sm" role="status"><span class="sr-only"></span></div>'
const smallSpinnerDanger = '<div class="spinner-border text-danger spinner-border-sm" role="status"><span class="sr-only"></span></div>'

let authClient;
let studentWallBackend;

window.onload = async () => {

  authClient = await AuthClient.create();

  if (await authClient.isAuthenticated()) {

    console.log({ authClient })

    let identity = authClient.getIdentity()

    studentWallBackend = createActor(canisterId, { agent: new HttpAgent({ identity }) })

    renderSendMessagesForm()

    quitLoginForm()

    await updateMessagesInDom()

    return
  }

  renderLoginForm()

}

loginForm.onsubmit = login;
logoutForm.onsubmit = logout;

// document.querySelector("form").addEventListener("submit", async (e) => {
//   e.preventDefault();
//   const button = e.target.querySelector("button");

//   const name = document.getElementById("name").value.toString();

//   button.setAttribute("disabled", true);

//   // Interact with foo actor, calling the greet method
//   const greeting = await StudentWall_backend.greet(name);

//   button.removeAttribute("disabled");

//   document.getElementById("greeting").innerText = greeting;

//   return false;
// });
