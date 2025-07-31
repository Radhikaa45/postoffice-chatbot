document.addEventListener('DOMContentLoaded', function() {
    
    const chatbotButton = document.getElementById('chatbotButton');
    const chatbotWindow = document.getElementById('chatbotWindow');
    const closeChatbot = document.getElementById('closeChatbot');
    const userInput = document.getElementById('userInput');
    const sendMessage = document.getElementById('sendMessage');
    const chatbotMessages = document.getElementById('chatbotMessages');

    chatbotButton.addEventListener('click', function() {
        chatbotWindow.classList.toggle('active');
    });

    closeChatbot.addEventListener('click', function() {
        chatbotWindow.classList.remove('active');
    });

    
    function sendUserMessage() {
        const message = userInput.value.trim();
        if (message) {
            // Add user message to chat
            const userMessageDiv = document.createElement('div');
            userMessageDiv.classList.add('user-message');
            userMessageDiv.innerHTML = `<p>${message}</p>`;
            chatbotMessages.appendChild(userMessageDiv);
            
          
            userInput.value = '';
            
            
            setTimeout(() => {
                const underConstructionDiv = document.createElement('div');
                underConstructionDiv.classList.add('under-construction');
                underConstructionDiv.innerHTML = '<p>Under Construction: Our chatbot is currently being developed. Please check back later.</p>';
                chatbotMessages.appendChild(underConstructionDiv);
                
                // Scroll to bottom of messages
                chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
            }, 500);
        }
    }


    sendMessage.addEventListener('click', sendUserMessage);

    
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendUserMessage();
        }
    });

   
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
});