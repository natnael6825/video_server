<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple WebRTC Video Chat</title>
    <style>
        body {
            margin: 0;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background-color: black;
        }

        video {
            position: absolute;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        #remoteVideo {
            z-index: 2; /* Make the remote video appear on top */
        }

        #localVideo {
            z-index: 1; /* Local video in the background */
            opacity: 0.3; /* Make the local video slightly transparent */
            pointer-events: none; /* Prevent interactions with local video */
        }
    </style>
</head>

<body>

    <video id="localVideo" autoplay playsinline muted></video>
    <video id="remoteVideo" autoplay playsinline></video>

    <script>
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');

        let localStream;
        let peerConnection;
        let socket;
        let orderId;
        let isConnected = false; // To track if the viewer is connected

        const signalingServerURL = 'wss://video-server-jn3s.onrender.com'; // Your WebSocket server URL

        // Function to extract the orderId from URL parameters
        function getOrderIdFromURL() {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('orderId');
        }

        // Automatically set the orderId from URL and start WebSocket connection
        function initializeConnection() {
            orderId = getOrderIdFromURL();
            if (!orderId) {
                alert('No Call ID found in URL. Please provide a valid Call ID.');
                return;
            }

            // Initialize WebSocket connection for signaling
            socket = new WebSocket(signalingServerURL);

            socket.onopen = () => {
                console.log('Connected to signaling server');
                startCall(); // Automatically start the call when connected
            };

            socket.onmessage = async (message) => {
                const data = JSON.parse(message.data);

                // Only process messages for the same orderId
                if (data.orderId !== orderId) return;

                if (data.type === 'offer') {
                    // Set the received offer as the remote description
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

                    // Create an answer and send it back through the signaling server
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    socket.send(JSON.stringify({ orderId, type: 'answer', answer }));
                }

                if (data.type === 'answer') {
                    // Set the received answer as the remote description
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                }

                if (data.type === 'candidate') {
                    // Add received ICE candidate to the RTCPeerConnection
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            };

            socket.onclose = () => {
                console.log('Disconnected from signaling server');
                if (!isConnected) {
                    // Retry connection in 5 seconds if no viewer is connected
                    setTimeout(initializeConnection, 5000);
                }
            };
        }

        // Function to start the call and create an offer/answer for WebRTC
        async function startCall() {
            // Get local media (use back camera on mobile devices)
            const constraints = {
                video: {
                    facingMode: { exact: "environment" } // Force back camera
                },
                audio: true
            };

            try {
                localStream = await navigator.mediaDevices.getUserMedia(constraints);
                localVideo.srcObject = localStream;
            } catch (error) {
                console.error('Error accessing media devices.', error);
            }

            // Create the RTCPeerConnection
            const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
            peerConnection = new RTCPeerConnection(config);

            // Add local stream tracks to the peer connection
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.send(JSON.stringify({ orderId, type: 'candidate', candidate: event.candidate }));
                }
            };

            // Handle incoming remote stream
            peerConnection.ontrack = (event) => {
                remoteVideo.srcObject = event.streams[0];
                isConnected = true; // Mark as connected when the remote stream is received
            };

            // Create an offer if this client initiates the call
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.send(JSON.stringify({ orderId, type: 'offer', offer }));
        }

        // Initialize the WebRTC connection when the page loads
        window.onload = initializeConnection;

    </script>
</body>

</html>
