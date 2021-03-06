const bcrypt = require('bcrypt');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const randomstring = require('randomstring');


function Auth(pool, smtpTransport, certificate) {
  if(! (this instanceof Auth) ){
    return new Auth(pool, smtpTransport, certificate);
  }
  this.pool = pool;
  this.smtpTransport = smtpTransport;
  this.certificate = certificate;
}


Auth.prototype.token = function(clientId, clientSecret, success, failure) {

  const query = {
    text: `SELECT salt 
    FROM users
    WHERE email = $1`,
    values: [clientId]
  }

  this.pool.query(query)
  .then(data => {
    if(data.rows.length == 0){
      failure('Authentication Failed');
      return;
    }
    const salt = data.rows[0].salt;
    const clientSecretSaltyHash = bcrypt.hashSync(clientSecret, salt);
    const query = {
      text: `SELECT email
      FROM users
      WHERE email = $1
      AND password = $2`,
      values: [clientId, clientSecretSaltyHash]
    }
    this.pool.query(query)
      .then(data => {
        if (data.rows.length == 1) {
          const token = jwt.sign({ client_id: clientId }, this.certificate);
          success(token);
        } else {
          failure('Authentication Failed');
        }
      });
  });

}

Auth.prototype.register = function(clientId, clientSecret, body, callback) {

  const salt = bcrypt.genSaltSync(10);
  const clientSecretSaltyHash = bcrypt.hashSync(clientSecret, salt);
  const query = {
    text: `INSERT INTO users
          (first_name, last_name, organization, phone, email, password, salt)
           VALUES
          ($1, $2, $3, $4, $5, $6, $7)`,
    values: [body['first_name'], body['last_name'],
       body['organization'], body['phone'], 
       clientId, clientSecretSaltyHash, salt ]
  }
  this.pool.query(query)
  .then(callback);
}

Auth.prototype.forgot = function(clientId, callback) {

 
  const query = {
    text: `SELECT * 
    FROM users
    WHERE email = $1`,
    values: [clientId]
  }

  this.pool.query(query)
  .then(data => { 
    resultid = data.rows[0].id;
    resultemail = data.rows[0].email;

    var newpassword = randomstring.generate({
       length: 12,
      charset: 'alphabetic'
    });
    const salt = bcrypt.genSaltSync(10);
    const clientnewSecretSaltyHash = bcrypt.hashSync(newpassword, salt);

    const query = {
       text: `UPDATE  
               users SET password = $2,
               salt = $3
                WHERE id = $1`,
        values: [resultid, clientnewSecretSaltyHash, salt]
    }
    console.log(query);
     this.pool.query(query)
      .then(data => {

        var mailOptions = {

          to: resultemail,
          subject: 'Password Reset - GreenStand', 
          html: 'Hello,<br>Try to login in again.<br>Your new password is: '+newpassword

        };
        console.log("sending");
        this.smtpTransport.sendMail(mailOptions, function(error, info){
          if(error){
            console.log(error);
            return; // should throw
          }
          console.log('Message sent: ' + info.response);
          callback(data);
        });

      });
 });
}

module.exports = Auth;
