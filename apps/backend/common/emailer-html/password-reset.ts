export function passwordResetHtml(link: string): string {
    return `
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
            <td align="center" style="padding: 40px 10px;">
                <table role="presentation" width="100%" style="max-width: 600px; background-color: #242424; border: 1px solid #333; border-radius: 8px; border-collapse: separate;" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                        <td style="padding: 40px;">
                            <h1 style="color: #ffffff; font-size: 20px; font-weight: 500; margin: 0 0 20px 0;">
                                Reset your password
                            </h1>
                            <p style="color: #cccccc; font-size: 16px; line-height: 1.5; margin: 0 0 30px 0;">
                                We received a request to reset your Cleanly password. Click the button below to choose a new one. This link expires in one hour.
                            </p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" bgcolor="#e0e0e0" style="border-radius: 6px;">
                                        <a href="${link}" target="_blank" style="padding: 12px 24px; font-size: 16px; color: #000000; font-weight: 500; text-decoration: none; display: inline-block;">
                                            Reset password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="color: #888888; font-size: 14px; margin: 40px 0 0 0;">
                                If you didn&apos;t ask for this, you can ignore this email.
                            </p>
                            <p style="color: #888888; font-size: 14px; margin: 15px 0 0 0;">
                                <a href="${link}" style="color: #0070f3; text-decoration: none;">Open reset link</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
  `;
}
