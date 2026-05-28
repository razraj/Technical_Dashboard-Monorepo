export const emailVerificationHtml = (link: string) => {
    return `
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
            <td align="center" style="padding: 40px 10px;">
                
                <table role="presentation" width="100%" style="max-width: 600px; background-color: #242424; border: 1px solid #333; border-radius: 8px; border-collapse: separate;" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                        <td style="padding: 40px;">
                            
                            <div style="margin-bottom: 30px;">
                               <img src="https://ticktock.com/favicon.ico" alt="ticktock logo" width="30" height="30" style="display: block; filter: brightness(0) invert(1);">
                            </div>

                            <h1 style="color: #ffffff; font-size: 20px; font-weight: 500; margin: 0 0 20px 0;">
                                Hello, welcome to ticktock!
                            </h1>

                            <p style="color: #cccccc; font-size: 16px; line-height: 1.5; margin: 0 0 30px 0;">
                                Click the button below to activate your account.
                            </p>

                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" bgcolor="#e0e0e0" style="border-radius: 6px;">
                                        <a href="${link}" target="_blank" style="padding: 12px 24px; font-size: 16px; color: #000000; font-weight: 500; text-decoration: none; display: inline-block;">
                                            Activate account
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 40px 0 30px 0;">
                                ticktock is a Fast, AI-powered guidance for athletes navigating supplements and medications
                            </p>

                            <hr style="border: 0; border-top: 1px solid #444; margin: 0 0 30px 0;">

                            <p style="color: #888888; font-size: 14px; margin: 0 0 15px 0;">
                                Button not working? Use this link instead: 
                                <a href="${link}" style="color: #0070f3; text-decoration: none;">Activate account</a>
                            </p>

                            <p style="color: #888888; font-size: 14px; margin: 0;">
                                To learn more about ticktock and all its features, check out our ticktock Website: 
                                <a href="https://ticktock.com" style="color: #888888; text-decoration: underline;">https://ticktock.com</a>
                            </p>

                        </td>
                    </tr>
                </table>

            </td>
        </tr>
    </table>
  `;

}