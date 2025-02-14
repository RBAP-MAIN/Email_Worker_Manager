import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

const PostalMime = require("postal-mime");

async function streamToArrayBuffer(stream, streamSize) {
  let result = new Uint8Array(streamSize);
  let bytesRead = 0;
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    result.set(value, bytesRead);
    bytesRead += value.length;
  }
  return result;
}

// Helper function to extract a link from the email body
function extractLinkFromBody(body) {
  // Regular expression to find URLs in the body
  const urlRegex = /https?:\/\/[^\s]+/g; 
  const matches = body ? body.match(urlRegex) : null; // Ensure body is defined before matching
  return matches ? matches[0] : null; // Return the first match or null if none found
}

export default {
  async email(event, env, ctx) {
    const rawEmail = await streamToArrayBuffer(event.raw, event.rawSize);
    const parser = new PostalMime.default();
    const parsedEmail = await parser.parse(rawEmail);
    console.log("Mail subject: ", parsedEmail.subject);
    console.log("Mail message ID", parsedEmail.messageId);
    console.log("HTML version of Email: ", parsedEmail.html);
    console.log("Text version of Email: ", parsedEmail.text);
    if (parsedEmail.attachments.length == 0) {
      console.log("No attachments");
    } else {
      parsedEmail.attachments.forEach((att) => {
        console.log("Attachment: ", att.filename);
        console.log("Attachment disposition: ", att.disposition);
        console.log("Attachment mime type: ", att.mimeType);
        console.log("Attachment size: ", att.content.byteLength);
      });
    }
    const allowList = "no-reply@roblox.com";
    const resetPasswordKeyword = "Reset Password";
    const emailVerificationKeyword = "Email Verification";

     // Check if the sender is allowed
     const isAllowedSender = event.headers.get('From').includes(allowList);
    
    if (!isAllowedSender) {
      const fromAddress = event.headers.get('From');
      const subject = event.headers.get('Subject');
      const bodyPreview = parsedEmail.text ? parsedEmail.text.substring(0, 50) : "No body content"; // Get first 50 characters or a default message
      message.setReject(`Address not allowed. From: ${fromAddress}, Subject: ${subject}, Body Preview: ${bodyPreview}`);  
      return;
    }

    // Check for "Reset Password" and "Email Verification" keywords
    const subjectContainsResetPassword = event.headers.get('Subject').includes(resetPasswordKeyword);
    const subjectContainsEmailVerification = event.headers.get('Subject').includes(emailVerificationKeyword);
    
    // If "Reset Password" is found, forward the message
    if (subjectContainsResetPassword) {
      await event.forward("middletonsfamily@outlook.com");
      return;
    }

    // If "Email Verification" is found, extract the link from the body
    if (subjectContainsEmailVerification) {
      const link = extractLinkFromBody(parsedEmail.text);
      if (link) {
        console.log("Extracted link:", link);
        
        // Make a GET request to the link
        try {
          const response = await fetch(link);
          // Check for a successful response
          if (response.ok) {
            console.log("Successfully opened the link:", link);
          } else {
            console.log("Failed to open the link. Status:", response.status);
          }
        } catch (error) {
          console.log("Error opening the link:", error);
        }
      } else {
       
        event.setReject("No link found in the email body: " +  parsedEmail.text + " From: " + event.headers.get('From'));
      }
      return;
    }

    // If neither keyword is found, reject the message
    event.setReject("No relevant keywords found");  
    
    //const msg = createMimeMessage();
    //msg.setSender({ name: "Auto-replier", addr: event.to });
    //msg.setRecipient(event.from);
    //msg.setSubject(`Re: ${parsedEmail.subject}`);
    //msg.setHeader("In-Reply-To", parsedEmail.messageId);
    //msg.addMessage({
      //contentType: "text/plain",
      //data: `This is an automated reply to your email with the subject ${parsedEmail.subject}.
//Number of attachments: ${parsedEmail.attachments.length}.

//good bye.`,
    //});

    //var message = new EmailMessage(event.to, event.from, msg.asRaw());
    //await event.reply(message);
  },
};
