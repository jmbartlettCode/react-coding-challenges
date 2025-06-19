import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import useSound from 'use-sound';
import config from '../../../config';
import LatestMessagesContext from '../../../contexts/LatestMessages/LatestMessages';
import TypingMessage from './TypingMessage';
import Header from './Header';
import Footer from './Footer';
import Message from './Message';
import '../styles/_messages.scss';
import initialBottyMessage from '../../../common/constants/initialBottyMessage';

const socket = io(
  config.BOT_SERVER_ENDPOINT,
  { transports: ['websocket', 'polling', 'flashsocket'] }
);

function Messages() {
  const [messages, setMessages] = useState([initialBottyMessage]);
  const [message, setMessage] = useState('');

  const [socketError, setScoketError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(true);

  const [playSend] = useSound(config.SEND_AUDIO_URL);
  const [playReceive] = useSound(config.RECEIVE_AUDIO_URL);
  const { setLatestMessage } = useContext(LatestMessagesContext);

  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const onConnect = () => {
      setSocketConnected(true);
      setScoketError(null);
      console.log('Socket connected');
    };

    const onConnectError = (error) => {
      setSocketConnected(false);
      setScoketError('Connection error. Please check your network.');
      console.error('Socket connection error:', error);
    };

    const onDisconnect = (reason) => {
      setSocketConnected(false);
      setScoketError('Disconnected from server. Please try reconnecting.');
      console.warn('Socket disconnected:', reason);
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('connection_error', onConnectError);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const handleReconnect = () => {
    setScoketError(null);
    socket.connect();
  };

  useEffect(() => {
    const handleBotTyping = () => {
      setMessages(prevMessages => {
        if (prevMessages.some(msg => msg.id === 'typing')) {
          return prevMessages;
        }
        return [
          ...prevMessages,
          {id: 'typing', user: 'bot', message: 'typing', isTyping: true}
        ];
      });
    };
    
    const handleBotMessage = (incomingMessage) => {
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.id !== 'typing').concat({
          id: 'bot-S{Date.now()}',
          user: 'bot', 
          message: incomingMessage
        })
      );
      setLatestMessage(incomingMessage);
      playReceive();
    };

    socket.on('bot-typing', handleBotTyping);
    socket.on('bot-message', handleBotMessage);

    return () => {
      socket.off('bot-typing', handleBotTyping);
      socket.off('bot-message', handleBotMessage);
    };
  }, [playReceive, setLatestMessage]);

  const onChangeMessage = (e) => {
    setMessage(e.target.value);
  };

  const sendMessage = useCallback(() => {
    if (!message.trim()) return;
    const userMessage = { id: 'user-${Date.now()}',user: 'me', message };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    socket.emit('user-message', message);
    setLatestMessage(message);
    setMessage('');
    playSend();
  }, [message, playSend, setLatestMessage]);

  return (
    <div className="messages">
      <Header />
      {socketError && (
        <div className="messages_error">
          <p>{socketError}</p>
          <button onClick={handleReconnect}>Reconnect</button>
        </div>
      )}

      <div className="messages__list" id="message-list">
        {messages.map((msg, index) => {
          if (msg.isTyping) {
            return <TypingMessage key={msg.id} />;
          } else {
            const nextMessage = messages[index + 1];
            const botTyping = nextMessage && nextMessage.isTyping;
            return(
              <Message key={msg.id} message={msg} nextMessage={nextMessage} botTyping={botTyping} />
            );
          }
        })}
        <div ref={messagesEndRef} />
      </div>
      
      <Footer message={message} sendMessage={sendMessage} onChangeMessage={onChangeMessage} />
    </div>
  );
}

export default Messages;
