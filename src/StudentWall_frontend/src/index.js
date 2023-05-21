import { canisterId, createActor } from "../../declarations/StudentWall_backend";
import { HttpAgent } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";

function renderSendMessagesForm() {
  let clone = document.importNode(sendMessageFormTemplate.content, true);
  sendMessageFormContainer.appendChild(clone);
  let sendMessageForm = document.getElementById('sendMessageForm');
  sendMessageForm.onsubmit = writeNewMessage;
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

async function writeNewMessage(e) {

  e.preventDefault()

  console.log(e.target.querySelector("#messageToEditId").value)

  let message = {
    id: Number(e.target.querySelector("#messageToEditId").value),
    userName: localStorage.userName,
    creator: authClient.getIdentity(),
    vote: 0,
    content: { Text: e.target.querySelector("textarea").value }
  }

  if (Number.isNaN(message.id)) {

    console.log('writing message')

    e.target.querySelector(".submitButton").innerHTML = spinner;
    e.target.querySelector(".submitButton").style.disabled = true;

    await studentWallBackend.writeMessage(message.content, message.userName);

    await updateMessagesInDom()

    e.target.querySelector(".submitButton").innerHTML = "";
    e.target.querySelector(".submitButton").innerText = "Send message";
    e.target.querySelector(".submitButton").style.disabled = false;

    return

  }

  e.target.querySelector(".submitButton").innerHTML = spinner;
  e.target.querySelector(".submitButton").style.disabled = true;
  e.target.querySelector(".cancelButton").innerHTML = spinnerDanger;
  e.target.querySelector(".cancelButton").style.disabled = true;

  await studentWallBackend.updateMessage(message.id, message.content);

  await updateMessagesInDom()

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

  sendMessageForm.querySelector("textarea").value = ""

}

async function setEditForm(messageId, content) {

  let sendMessageForm = document.getElementById('sendMessageForm');

  sendMessageForm.querySelector('.submitButton').innerText = "Edit message"

  sendMessageForm.querySelector('.cancelButton').style.display = "block"
  sendMessageForm.querySelector('.cancelButton').onclick = cancelEditForm

  sendMessageForm.querySelector('#messageToEditId').value = messageId
  sendMessageForm.querySelector("textarea").value = content

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

function renderMessages(messages) {
  const fragment = document.createDocumentFragment();
  messagesContainer.innerHTML = "";

  let gettingLastUpdatesTitle = document.createElement('h3')
  gettingLastUpdatesTitle.className = "col-7 bg-dark mb-2 text-white text-start font-rubik"
  gettingLastUpdatesTitle.innerText = "Getting last updates..."

  if(messagesContainerTitle.childElementCount > 0) messagesContainerTitle.removeChild(messagesContainerTitle.firstElementChild)
  messagesContainerTitle.appendChild(gettingLastUpdatesTitle)

  messages.forEach(message => {
    let clone = document.importNode(messageTemplate.content, true);

    let voted = message.voteBy.includes(localStorage.idSession)
    // let identity = authClient

    clone.querySelector(".userName").innerText = message.userName;
    clone.querySelector(".content").innerText = message.content.Text;
    clone.querySelector(".creator").innerText = message.creator;
    clone.querySelector(".vote").innerText = message.vote;
    clone.querySelector(".deleteButton").dataset.messageId = message.id;
    clone.querySelector(".deleteButton").onclick = (e) => deleteMessage(e, message.id);
    clone.querySelector(".editButton").dataset.messageId = message.id;
    clone.querySelector(".editButton").onclick = (e) => setEditForm(message.id, message.content.Text);
    clone.querySelector(".voteButton").dataset.messageId = message.id;
    clone.querySelector(".voteButton").onclick = (e) => voteMessage(e, voted, message.id);
    clone.querySelector(".voteButton").dataset.voted = "false"
    clone.querySelector(".voteButton").querySelector('.votedIcon').style.display = "none"
    clone.querySelector(".voteButton").querySelector('.noVotedIcon').style.display = "inline"

    if (message.creator != localStorage.idSession) {
      clone.querySelector(".deleteButton").style.display = "none"
      clone.querySelector(".editButton").style.display = "none"
    }

    if (message.voteBy.includes(localStorage.idSession)) {
      clone.querySelector(".voteButton").querySelector('.votedIcon').style.display = "inline"
      clone.querySelector(".voteButton").querySelector('.noVotedIcon').style.display = "none"
    }

    fragment.appendChild(clone);
  });

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
