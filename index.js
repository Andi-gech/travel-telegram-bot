const express = require('express');
const app = express();
const upload = require('./multerConfig');
const ethiopianDate = require('ethiopian-date');
const TelegramBot = require('node-telegram-bot-api');
const {ObjectId } = require('mongodb');
const { format } = require('date-fns');
const Travel=require('./Model/Travel')
const User=require('./Model/Users');
const connectDB = require('./db');
const cloudinary = require('./cloudinaryConfig');
const cors = require('cors');

app.use(cors());
app.use(express.json());
  

// === Configuration ===
const BOT_TOKEN = process.env.BOT_TOKEN
console.error('BOT_TOKEN:', BOT_TOKEN);

const ADMIN_ID = [445168632,408048964]; // Replace with actual admin IDs

const GROUP_CHAT_ID = -1002208449319;
const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    interval: 300,    // Check every 5 minutes
    autoStart: true,
    params: {
      timeout: 10    // Wait 10 seconds for updates
    }
  }
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});


connectDB();
// === State Management ===
const userStates = new Map();
const adminCreateStates = new Map();

// === Formatting Helpers ===
const formatGregorianDate = (date) => format(date, 'dd MMM yyyy');
const bold = (text) => `*${text}*`;

// === Menu Keyboards ===
const mainMenu = {
  reply_markup: {
    keyboard: [
      ['🏕 Current Trips', '📝 My Registrations'],
      ['ℹ️ Help', '🚀 ይመዝገቡ']
    ],
    resize_keyboard: true
  }
};

const adminMenu = {
  reply_markup: {
    keyboard: [
      ['📅 አዲስ ጉዞ ፍጠር', '👥 ተሳታፊዎችን ይመልከቱ'],
      ['📊 ስታቲስቲክስ', 'Delete Current Trip','Verify Users']
    ],
    resize_keyboard: true
  }
};

// === Help Message ===
const helpMessage = `🆘 *Help Guide* 🆘

*Available Commands:*
🏕 Current Trips - View active trip details  
📝 My Registrations - Check your registration status  
🚀 ይመዝገቡ - Start new registration  
ℹ️ Help - Show this help message

*Registration Process:*
1. Click 🚀 ይመዝገቡ  
2. Send your full name  
3. Upload payment screenshot  
4. Wait for admin approval

📧 Contact admin for any issues!`;




// Current Trips Handler
bot.onText(/🏕 Current Trips/, (async (msg) => {
  const chatId = msg.chat.id;
  try {
    const travel = await Travel.findOne({ isActive: true });
    if (!travel) return bot.sendMessage(chatId, 'ℹ️ No active trips available.');

    const startDate = formatGregorianDate(travel.startDate);
    const endDate = formatGregorianDate(travel.endDate);
    const now = new Date();
    const status = now < travel.startDate ? 'Upcoming' : 'Ongoing';

    const message = `🏕 *Current Trip Details*\n\n` +
      `✈️ *Name:* ${travel.name}\n` +
      `📅 *Dates:* ${startDate} - ${endDate}\n` +
      `⏰ *Status:* ${status}`;

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Current trips error:', error);
    bot.sendMessage(chatId, '❌ Error retrieving trip information.');
  }
}));
bot.onText(/Verify Users/, (async (msg) => {
  const travel = await Travel.findOne({ isActive: true });
  if (!travel) return bot.sendMessage(msg.chat.id, 'ℹ️ No active trips available.');
  const participants = await User.find({ travelId: travel._id, paymentStatus:"pending"  }).populate('travelId');
  if (participants.length === 0) return bot.sendMessage(msg.chat.id, 'ℹ️ No pending registrations to verify.');
bot.sendMessage(msg.chat.id, `👥 *የ ${travel.name} ተሳታፊዎች*\n\n`);
  participants.forEach((p, index) => {
   const keyboard = {
    inline_keyboard: [[
      { text: '✅ Approve', callback_data: `approve_${p._id}` },
      { text: '❌ Deny', callback_data: `deny_${p._id}` }
    ]]
  };
 bot.sendPhoto(msg.chat.id, p.screenshot, {
    caption: `📮 *አዲስ ምዝገባ*\n\n👤 *ስም:* ${p.name}\n 🆔 *User ID:* ${p._id}\n📅 *ቀን:* ${formatGregorianDate(p.createdAt  )}`, parse_mode: 'Markdown', reply_markup: keyboard }
  );
})
  }));

  

bot.onText(/📝 My Registrations/, (async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  try {
    const userReg = await User.findOne({ telegramId: userId });
    if (!userReg) return bot.sendMessage(chatId, 'ℹ️ You have no active registrations.');

    const travel = await Travel.findOne({ _id: new ObjectId(userReg.travelId) });
    const statusEmoji = userReg.paymentStatus === 'verified' ? '✅' : '⌛';
    
    const message = `📋 *የእርስዎ ምዝገባ *\n\n` +
      `✈️ *መድረሻ:* ${travel?.name || 'Deleted Trip'}\n` +
      `📅 *የምዝገባ ቀን:* ${formatGregorianDate(userReg.createdAt)}\n` +
      `🔄 *ሁኔታ:* ${statusEmoji} ${userReg.paymentStatus.toUpperCase()}`;

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Registrations error:', error);
    bot.sendMessage(chatId, '❌ የምዝገባ ዝርዝሮችን ማውጣት አልተሳካም። እባክዎ እንደገና ይሞክሩ');
  }
}));

// Help Handler
bot.onText(/ℹ️ Help/, (msg) => {
  bot.sendMessage(msg.chat.id, helpMessage, { 
    parse_mode: 'Markdown',
    reply_markup: mainMenu.reply_markup 
  });
});
bot.onText(/Delete Current Trip/, (msg) => {
  if (!ADMIN_ID.includes(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, 'Are you sure you want to delete the current trip?', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Yes', callback_data: 'delete_trip' },
          { text: '❌ No', callback_data: 'cancel_delete' }
        ]
      ]
    }
  });
}
);


// View Participants Handler (Admin)
bot.onText(/👥 ተሳታፊዎችን ይመልከቱ/, (async (msg) => {
  if (!ADMIN_ID.includes(msg.from.id)) return;
  
  try {
    const travel = await Travel.findOne({ isActive: true });
    if (!travel) return bot.sendMessage(msg.chat.id, 'ℹ️ No active trip to show participants.');
console.log('Travel:', travel._id.toString());
    const participants = await User.find({ travelId: travel._id })
    
    console.log('Participants:', participants)
    let message = `👥  የ ${travel.name} ተሳታፊዎች\n\n`;
    message += `NO   NAME     PICKUP    PHONE \n`;
    message += `**>`;
 
    participants.forEach((p, index) => {
      message += `>${index + 1}       ${p.name}    ${p.pickupLocation}    ${p.phoneNumber} \n\n`;
    });

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    console.error('Participants error:', error);
    bot.sendMessage(msg.chat.id, '❌ Error retrieving participants.');
  }
}));


bot.onText(/📊 ስታቲስቲክስ/, (async (msg) => {
  if (!ADMIN_ID.includes(msg.from.id)) return;

  try {
    const travel = await Travel.findOne({ isActive: true });
    if (!travel) return bot.sendMessage(msg.chat.id, 'ℹ️ No active trip to show stats.');

    const stats = await User.aggregate([
      { $match: { travelId: travel._id } },
      { $group: { _id: '$paymentStatus', count: { $sum: 1 } } },
    ]);
    console.log('Stats:', stats);

    let message = `📊 *የጉዞ ስታቲስቲክስ*\n\n` +
      `✈️ *Trip:* ${travel.name}\n\n`;
    
    stats.forEach(s => {
      message += `• ${s._id.toUpperCase()}: ${s.count}\n`;
    });

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Stats error:', error);
    bot.sendMessage(msg.chat.id, '❌ Error retrieving statistics.');
  }
}));

// Main Menu Handler
// bot.onText(/🏠 Main Menu/, (msg) => {
//   const isAdmin = ADMIN_ID.includes(msg.from.id);
//   bot.sendMessage(msg.chat.id, '🏠 ወደ ዋና በመመለስ ላይ...', {
//     reply_markup: isAdmin ? adminMenu.reply_markup : mainMenu.reply_markup
//   });
// });
function formatGregorianDates(date) {
  const gregorianDate = new Date(date); // Convert to Date object
  const year = gregorianDate.getFullYear();
  const month = gregorianDate.getMonth() + 1; // Adding 1 because months are zero-based
  const day = gregorianDate.getDate();
  return [year, month, day]; // Return formatted date
}
// Start Command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  try {
   

    let caption = `
   ⛪️ የቅዱስ ሚካኤል መንፈሳዊ ጉዞ ማህበር - | ዱከም | መመዝገቢያ ቦት ሲሆን በሚዘጋጁ የተለያዩ ጉዞዎች ላይ ለመመዝገብ ከታች ያሉትን በተኖች ይጠቀሙ ⛪️

ለበለጠ መረጃ የማህበሉ ሶሻል ሚድያ 
ቴሌግራም ⬇️

https://t.me/+7oOitRT0XNoxZTU8

ቲክቶክ ⬇️

https://www.tiktok.com/@dukem_yeguzo_mahiber?_t=ZM-8vVUu5KPvtf&_r=1

ኢንስታግራም ⬇️

https://www.instagram.com/kidusmichael_yeguzo_mahber?igsh=MThleXhnc204NW8yZw== `;

    
  
 await bot.sendMessage(chatId, caption, {
      parse_mode: 'Markdown',
 
    });

  } catch (error) {
    console.error('Start command error:', error);
    bot.sendMessage(chatId, '❌ ይቅርታ፣ መረጃውን ማግኘት አልተቻለም። እባኮትን እንደገና ይሞክሩ።');
  }
});


// Registration Flow for Users
bot.onText(/🚀 ይመዝገቡ/, (async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const today = new Date();
    const travel = await Travel.findOne({ isActive: true,endDate: { $gte: today } });

    if (!travel) return bot.sendMessage(chatId, '🚫 ይቅርታ፣ ወቅታዊ ጉዞ የለም/አብቅቷል። እባኮትን እንደገና ይሞክሩ።');

    userStates.set(userId, {
      step: 'awaitingName',
      travelId: travel._id.toString(),
      AccountName: travel.AccountName,
      AccountNo: travel.AccountNo,
      Price: travel.Price,
    });

    bot.sendMessage(chatId, '📝 *Registration Started*\nእባክዎን ሙሉ ስምዎን ይላኩ፡-', {
      parse_mode: 'Markdown',
      reply_markup: { remove_keyboard: true }
    });
  } catch (error) {
    console.error('Registration error:', error);
    bot.sendMessage(chatId, '❌ Error starting registration. Please try again.');
  }
}));


bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  // Registration flow for users
  if (userStates.has(userId)) {
    const state = userStates.get(userId);
    if (state.step === 'awaitingName') {
      state.name = text;
      state.step = 'awaitingPhoneNumber';
      userStates.set(userId, state);

      bot.sendMessage(chatId, '📞 *እባክዎን የስልክ ቁጥርዎን ይላኩ።*', { parse_mode: 'Markdown' });
    } else if (state.step === 'awaitingPhoneNumber') {
      state.phoneNumber = text;
      state.step = 'awaitingPickupLocation';
      userStates.set(userId, state);

      bot.sendMessage(chatId, '📍 *እባክዎን pickup Adress ይላኩ።*', { parse_mode: 'Markdown' });
    } else if (state.step === 'awaitingPickupLocation') {
      state.pickupLocation = text;
      state.step = 'awaitingScreenshot';
      userStates.set(userId, state);
     

    
      const confirmationMessage = `
**>
>👤 ስም: ${state.name}
>📞 የስልክ ቁጥር: ${state.phoneNumber}
>📍 pickup Adress: ${state.pickupLocation}

💵 *እባክዎን የክፍያ መረጃ ይመልከቱ*:
**>
>🔹 ምዝገባውን ለመጨረስ ${state.Price} ብር ወደ።
>🔹 አካውንት ቁጥር: ${state.AccountNo}
>🔹 ስም: ${state.AccountName}


📝 *እባክዎን የክፍያዎን ደረሰኝ ይላኩ።*
📸 *ማስታወሻ:* ፎቶ የሚታይ መሆኑን ያረጋግጡ
`;
      
      bot.sendMessage(chatId, confirmationMessage, { parse_mode: 'MarkdownV2' });
    }
  }
});


bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const state = userStates.get(userId);

  if (!state || state.step !== 'awaitingScreenshot') return;

  try {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    
    const user = {
      telegramId: userId.toString(),
      name: state.name,
      travelId: state.travelId,
      paymentStatus: 'pending',
      phoneNumber: state.phoneNumber,
      pickupLocation: state.pickupLocation,
      screenshot: fileId,
      createdAt: new Date()
    };


    const result = await User.insertOne(user);
    console.log('User registration:', result);
    userStates.delete(userId);

    bot.sendMessage(chatId,
      '🕒 *ምዝገባዎ እየተገመገመ ነው። ከተፈቀደ በኋላ እናሳውቅዎታለን*።',
      { parse_mode: 'Markdown', reply_markup: mainMenu.reply_markup }
    );

    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Approve', callback_data: `approve_${result._id}` },
        { text: '❌ Deny', callback_data: `deny_${result._id}` }
      ]]
    };

    ADMIN_ID.forEach((adminId) => {
      bot.sendPhoto(adminId, fileId, {
        caption: `📮 *አዲስ ምዝገባ*\n\n👤 *ስም:* ${user.name}\n🆔 *User ID:* ${result._id}\n📅 *ቀን:* ${formatGregorianDate(new Date())}`,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    bot.sendMessage(chatId, '❌ Failed to process registration. Please try again later.', {
      reply_markup: mainMenu.reply_markup
    });
  }
});

// --- Trip Creation for Admin ---............................................

bot.onText(/📅 አዲስ ጉዞ ፍጠር/, (async (msg) => {
  if (!ADMIN_ID.includes(msg.from.id)) return;

  adminCreateStates.set(msg.from.id, {
    step: 'awaitingTripName',
    tempData: {}
  });

  bot.sendMessage(msg.chat.id, `Let's create a new trip!\n\nእባክዎ *የጉዞ መድረሻውን* ያስገቡ።`, {
    parse_mode: 'Markdown',
  });
}));
bot.on('message', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!adminCreateStates.has(userId)) return;

  const state = adminCreateStates.get(userId);
  const startDate = new Date();
  switch (state.step) {
    
    case 'awaitingTripName':
      state.tempData.name = text.trim();
      state.step = 'awaitingEndDate'; 
      adminCreateStates.set(userId, state);

      bot.sendMessage(chatId, '📅 እባኮትን *የምዝገባ ማብቂያ ቀን* በ(ዓዓዓ-ወወ-ቀን)', {
        parse_mode: 'Markdown'
      });
      break;

    case 'awaitingEndDate':
      if (!isValidDate(text)) {
        return bot.sendMessage(chatId, '❗ Invalid date format. Please enter the date as YYYY-MM-DD:');
      }

      const [eYear, eMonth, eDay] = text.split('-').map(Number);
      const endDate = ethiopianDate.toGregorian(...formatGregorianDates(new Date(eYear, eMonth - 1, eDay)));

     
      

      if (endDate <= startDate) {
        return bot.sendMessage(chatId, '❗ End date must be after the start date. Please enter a valid end date.');
      }

      state.tempData.endDate = endDate;
      state.tempData.startDate = startDate; // Set start date to now
      state.step = 'awaitingAccountName';  // Move to the next step
      adminCreateStates.set(userId, state);

      bot.sendMessage(chatId, '💳 እባኮትን *የአካውንት ስም* ያስገቡ።', {
        parse_mode: 'Markdown'
      });
      break;

    case 'awaitingAccountName':
      state.tempData.AccountName = text.trim();
      state.step = 'awaitingAccountNo'; // Next step to account number
      adminCreateStates.set(userId, state);

      bot.sendMessage(chatId, '💳 እባኮትን *የአካውንት ቁጥር* ያስገቡ።', {
        parse_mode: 'Markdown'
      });
      break;

    case 'awaitingAccountNo':
      state.tempData.AccountNo = text.trim();
      state.step = 'awaitingTripDate'; // Next step to price
      adminCreateStates.set(userId, state);

      bot.sendMessage(chatId, '💰 እባኮትን *የጉዞ Date* ያስገቡ።', {
        parse_mode: 'Markdown'
      });
      break;

    case 'awaitingTripDate':
      state.tempData.TripDate = text.trim();
      state.step = 'awaitingPrice'; // Next step to price
      adminCreateStates.set(userId, state);
      bot.sendMessage(chatId, '💰 እባኮትን *የጉዞ ዋጋ* ያስገቡ።', {
        parse_mode: 'Markdown'
      });
      break;
      


    case 'awaitingPrice':
      const price = parseFloat(text.trim());
      if (isNaN(price)) {
        return bot.sendMessage(chatId, '❗ Invalid price. Please enter a valid number for the trip price:');
      }

      state.tempData.Price = price;
      const { name, AccountName, AccountNo,endDate:gg } = state.tempData;

      // Now send the trip summary
      const message = `📝 *Confirm New Trip*\n\n` +
        `🏕 *Name:* ${name}\n` +
        `📅 *Start Date:* ${ethiopianDate.toEthiopian(...formatGregorianDates(startDate))}\n` +
        `📅 *End Date:* ${ethiopianDate.toEthiopian(...formatGregorianDates(gg))}\n` +
        `💳 *Account Name:* ${AccountName}\n` +
        `💳 *Account No:* ${AccountNo}\n` +
        `💰 *Price:* ${price}\n\n` +
        `⚠️ This will *deactivate* all existing trips!`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '✅ Confirm', callback_data: 'confirm_trip' },
            { text: '❌ Cancel', callback_data: 'cancel_trip' }
          ]
        ]
      };

      bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      state.step = 'awaitingConfirmation';
      adminCreateStates.set(userId, state);
      break;

    case 'awaitingConfirmation':
      bot.sendMessage(chatId, '⏳ Please confirm or cancel the trip using the buttons above.');
      break;
  }
});


//...................................................................


// Handle callback queries (like confirm trip)
bot.on('callback_query', async (query) => {
  const { data, message } = query;

  if (data.startsWith('confirm_trip')) {
    const userId = query.from.id;

    if (!ADMIN_ID.includes(userId)) return;

    try {
      const state = adminCreateStates.get(userId);
      if (!state) return;

      const { name, endDate,AccountName,AccountNo,Price,TripDate } = state.tempData;

      // Create the new trip in the database
      const newTrip = {
        name,
        startDate: new Date(), // Set to now
        endDate,
        AccountName,
        AccountNo,
        Price,
        TripDate,
        isActive: true,
      };

      // Deactivate all existing trips
      await Travel.updateMany({}, { $set: { isActive: false } });

      // Insert the new trip
      await Travel.insertOne(newTrip);
      adminCreateStates.delete(userId);

      bot.sendMessage(message.chat.id, `✅ *Trip "${name}" has been created successfully!*\n\n📅 *End Date:* ${formatGregorianDate(endDate)}`, {
        parse_mode: 'Markdown',
        reply_markup: adminMenu.reply_markup
      });
    } catch (error) {
      console.error('Error confirming trip:', error);
      bot.sendMessage(message.chat.id, '❌ Failed to confirm the trip. Please try again later.');
    }
  }

  if (data.startsWith('cancel_trip')) {
    const userId = query.from.id;

    if (!ADMIN_ID.includes(userId)) return;

    adminCreateStates.delete(userId);
    bot.sendMessage(message.chat.id, '❌ Trip creation has been canceled.', {
      reply_markup: adminMenu.reply_markup
    });
  }
  if(data.startsWith('approve_')) {
    const userId = query.from.id;
    const messageId = query.message.message_id;
    const chatId = query.message.chat.id;
    if (!ADMIN_ID.includes(userId)) return;
    
console.log('Approve data:', data);
    const registrationId = data.split('_')[1];
    if (!registrationId) return bot.sendMessage(message.chat.id, '❌ Invalid registration ID.');
    const user=await User.findById(registrationId).populate('travelId');
    if (!user) return bot.sendMessage(message.chat.id, '❌ Registration not found.');
    user.paymentStatus = 'verified';
    await user.save();
    // console.log(message)
    
    bot.answerCallbackQuery(query.id, { text: '✅ Registration approved!' });
    // bot.sendMessage(message.chat.id, `✅ Registration approved for ${user.name}.`);
    bot.sendMessage(user.telegramId, `✅ውድ ${user.name} የ ${user.travelId.name} ምዝገባዎ ተረጋግጧል .`);
    const AllUsers = await User.find({ travelId: user.travelId._id,paymentStatus:"verified"
     }).populate('travelId');
     let message = `👥  የ ${user.travelId.name} ጉዞ ተሳታፊዎች\n\n`;
    message += `**>`;
 
    AllUsers.forEach((p, index) => {
      message += `>${index + 1} ${p.name} \n\n`;
    });
    bot.sendMessage(GROUP_CHAT_ID, message, { parse_mode: 'MarkdownV2' });
    bot.deleteMessage(chatId, messageId).catch((error) => {
      console.error('Error deleting message:', error);
    }
    );
    
    
  }
  if(data.startsWith('deny_')) {
    const userId = query.from.id;
    const messageId = query.message.message_id;
    const chatId = query.message.chat.id;
    if (!ADMIN_ID.includes(userId)) return;

    const registrationId = data.split('_')[1];
        const user=await User.findById(registrationId).populate('travelId');
    if (!user) return bot.sendMessage(message.chat.id, '❌ Registration not found.');
    user.paymentStatus = 'denied';
    await user.save();

    bot.deleteMessage(chatId, messageId).catch((error) => {
      console.error('Error deleting message:', error);
    }
    );

    bot.answerCallbackQuery(query.id, { text: '❌ Registration denied!' });
    bot.sendMessage(message.chat.id, `❌ Registration denied for ${registrationId}.`);
    bot.sendMessage(userId, `❌ Registration denied for ${registrationId}.`);
  }
  if (data === 'delete_trip') {
    const userId = query.from.id;
    if (!ADMIN_ID.includes(userId)) return;

    try {
      await Travel.updateMany({}, { $set: { isActive: false } });
      bot.sendMessage(message.chat.id, '✅ Current trip has been deleted successfully!');
    } catch (error) {
      console.error('Error deleting trip:', error);
      bot.sendMessage(message.chat.id, '❌ Failed to delete the trip. Please try again later.');
    }
  }
  if (data === 'cancel_delete') {
    const userId = query.from.id;
    if (!ADMIN_ID.includes(userId)) return;

    bot.sendMessage(message.chat.id, '❌ Trip deletion has been canceled.', {
      reply_markup: adminMenu.reply_markup
    });
  }
});

// Helper: Validate YYYY-MM-DD format
function isValidDate(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}
app.get('/health', (req, res) => {
  res.status(200).send('OK');
}
)
const uploads = [];
app.get('/current',async (req, res) => {
  try {
    const travel = await Travel.findOne({ isActive: true });
    if (!travel) return res.status(400).json({ error: 'No active trips available' });
    const users = await User.find({ travelId: travel._id }).populate('travelId');
    if (!users || users.length === 0) return res.status(404).json({ error: 'No pending registrations found' });
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching verified users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
})    

app.post('/register', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
   
    const {name,phone:phoneNumber,telegramId,pickup:pickupLocation}=req.body;
    if (!name )return res.status(400).json({ error: 'Name is required' });
    if (!phoneNumber) return res.status(400).json({ error: 'Phone number is required' });
    if (!telegramId) return res.status(400).json({ error: 'Telegram ID is required' });
    if (!pickupLocation) return res.status(400).json({ error: 'Pickup location is required' });
    if (!req.file) return res.status(400).json({ error: 'Screenshot is required' });
    const travel = await Travel.findOne({ isActive: true,registrationactive:true });
    if (!travel) return res.status(400).json({ error: 'No active trips available' });


    // File URL returned by Cloudinary after upload
    const fileUrl = req.file.path;
    const publicId = req.file.filename; // Cloudinary stores the filename as public_id
    console.log(fileUrl);
   
    const confirmationMessage = `<b>የጉዞ ምዝገባዎን ይመልከቱ።</b>\n\n` +
  `👤 <b>ስም:</b> ${name}\n` +
  `📞 <b>የስልክ ቁጥር:</b> ${phoneNumber}\n` +
  `📍 <b>Pickup Location:</b> ${pickupLocation}\n\n` +
  `💵 <b>ዋጋ:</b> ${travel.Price} ብር\n\n` +
  `💳 <b>አካውንት ቁጥር:</b> ${travel.AccountNo}\n` +
  `💳 <b>አካውንት ስም:</b> ${travel.AccountName}\n\n`;

    console.log("telegram id",telegramId);
    const sentMessage = await bot.sendPhoto(telegramId.toString(), fileUrl,{
      caption: confirmationMessage,
      parse_mode: "HTML",
      reply_markup: { remove_keyboard: true }
    });
    console.log("console sent message")
    const fileId = sentMessage.photo.pop().file_id;
    console.log(sentMessage.photo.pop())
    const user = {
      telegramId: telegramId.toString(),
      name,
      travelId: travel._id.toString(),
      paymentStatus: 'pending',
      phoneNumber,
      pickupLocation,
      screenshot: fileId,
      createdAt: new Date()
    };
    const result = await User.insertOne(user);
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Approve', callback_data: `approve_${result._id}` },
        { text: '❌ Deny', callback_data: `deny_${result._id}` }
      ]]
    };

    ADMIN_ID.forEach((adminId) => {
      bot.sendPhoto(adminId, fileId, {
        caption: `📮 *አዲስ ምዝገባ*\n\n👤 *ስም:* ${user.name}\n🆔 *User ID:* ${result._id}\n📅 *ቀን:* ${formatGregorianDate(new Date())}`,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    });
    bot.sendMessage(telegramId, '🕒 *ምዝገባዎ እየተገመገመ ነው። ከተፈቀደ በኋላ እናሳውቅዎታለን*።',  {
      parse_mode: 'Markdown',
      reply_markup: { remove_keyboard: true }
    });


   

    // Remove the file from Cloudinary after posting to Telegram
    await cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        console.log('Error removing file from Cloudinary:', error);
      } else {
        console.log('File removed from Cloudinary:', result);
      }
    });

    res.status(200).json({
      success: true,
      fileId,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Upload failed' });
  }
});
app.get('/verfyusers', async (req, res) => {
  try {
    // Step 1: Get the active travel
    const travel = await Travel.findOne({ isActive: true });
    if (!travel) {
      return res.status(400).json({ error: 'No active trips available' });
    }

    // Step 2: Find users with pending payment
    const users = await User.find({ travelId: travel._id, paymentStatus: 'pending' });
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'No pending registrations found' });
    }

    // Step 3: Convert screenshot file IDs to URLs
    const usersWithScreenshots = await Promise.all(
      users.map(async (user) => {
        try {
          const screenshotUrl = await bot.getFileLink(user.screenshot);
          const plainUser = user.toObject(); // Convert Mongoose doc to plain object
          return {
            ...plainUser,
            screenshot: screenshotUrl,
          };
        } catch (error) {
          console.error(`Error processing screenshot for user ${user._id}:`, error);
          const plainUser = user.toObject();
          return {
            ...plainUser,
            screenshot: null,
          };
        }
      })
    );

    // Step 4: Respond with processed users
    res.status(200).json(usersWithScreenshots);
  } catch (error) {
    console.error('Error fetching verified users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/approve/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const travel = await Travel.findOne({ isActive: true });
    if (!travel) return res.status(400).json({ error: 'No active trips available' });
    const user = await User.findByIdAndUpdate(id, { paymentStatus: 'verified' }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    bot.sendMessage(user.telegramId, `✅ውድ ${user.name} የ ${travel.name} ምዝገባዎ ተረጋግጧል .`);
    res.status(200).json(user);
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
)
app.put('/deny/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const travel = await Travel.findOne({ isActive: true });
    if (!travel) return res.status(400).json({ error: 'No active trips available' });
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    bot.sendMessage(user.telegramId, `❌ውድ ${user.name} የ ${travel.name} ምዝገባዎ አልተቀበለም .`);
    res.status(200).json({ message: 'User registration denied and deleted successfully' });
  } catch (error) {
    console.error('Error denying user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
);
app.get('/CurrentTrip', async (req, res) => {
  try {
    const travel = await Travel.findOne({ 
      isActive:true
      });
    
    if (!travel) return res.status(400).json({ error: 'No active trips available' });
    res.status(200).json(travel);
  } catch (error) {
    console.error('Error fetching current trip:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
);
app.post('/toggleRegistration', async (req, res) => {
  try {
    const travel = await Travel.findOne({ 
      isActive: true });
    if (!travel) return res.status(400).json({ error: 'No active trips available' });
     travel.registrationactive = !travel.registrationactive;
    await travel.save();
    res.status(200).json({ message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
);
app.post('/createTrip', async (req, res) => {
  try {
    const { name, endDate, AccountName, AccountNo, Price,TripDate } = req.body;
    if (!name || !endDate || !AccountName || !AccountNo || !Price|| !TripDate) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const startDate = new Date(); // Set start date to now
    

    if (endDate <= startDate) {
      return res.status(400).json({ error: 'End date must be after the start date' });
    }

    

    const newTrip = {
      name,
      startDate,
      endDate,
      AccountName,
      AccountNo,
      Price,
      TripDate,
      isActive: true,
    };

    // Deactivate all existing trips
    await Travel.updateMany({}, { $set: { isActive: false } });

    // Insert the new trip
    await Travel.insertOne(newTrip);
    res.status(200).json({ message: 'Trip created successfully' });
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
);
app.post('/postlisttogroup', async (req, res) => {
  try {
   
    const travel = await Travel.findOne({ isActive: true });
    if (!travel) return res.status(400).json({ error: 'No active trips available' });
    const participants = await User.find({ travelId: travel._id,paymentStatus: 'verified' }).populate('travelId');
    if (!participants || participants.length === 0) return res.status(404).json({ error: 'Participants not found' });
    let msg = `👥  የ ${travel.name} ጉዞ ተሳታፊዎች\n\n`;
    msg += `**>`;
 
    participants.forEach((p, index) => {
      msg += `>${index + 1} ${p.name} \n`;
    });
    
    bot.sendMessage(GROUP_CHAT_ID, msg, { parse_mode: 'MarkdownV2' });
    res.status(200).json({ message: 'Message sent to group successfully' });
  } catch (error) {
    console.error('Error sending message to group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
);


app.get('/myRegistration/:telegramId', async (req, res) => {

  const { telegramId } = req.params;
  try {
    const user = await User.find({ telegramId }).populate('travelId');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
);
app.get('/participants', async (req, res) => {
  
  try {
    const travel = await Travel.findOne({ isActive: true });
    if (!travel) return res.status(400).json({ error: 'No active trips available' });
    const travelId = travel._id.toString();
    const participants = await User.find({ travelId,paymentStatus: 'verified' })
    if (!participants) return res.status(404).json({ error: 'Participants not found' });
    res.status(200).json({
      participants,
      name:travel.name,
      RegEnd:travel.endDate,
    });
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
);
app.get('/stastics',async (req,res)=>{
  try {
    const travel = await Travel.findOne({ isActive: true });
    if (!travel) return res.status(400).json({ error: 'No active trips available' });
    const travelId = travel._id.toString();
    const participants = await User.find({ travelId });
    if (!participants) return res.status(404).json({ error: 'Participants not found' });
    const totalParticipants = participants.length;
    const verifiedParticipants = participants.filter(participant => participant.paymentStatus === 'verified').length;
    res.status(200).json({ totalParticipants, verifiedParticipants });
  }
  catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
);

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  bot.stopPolling();
  bot.startPolling(); // Restart polling mechanism
});
// Export the Express app
module.exports = app;
const startServer = () => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT,() => {
    console.log(`Server running on http://192.168.1.9:3000`);
    
    // Self-pinging mechanism
    setInterval(() => {
      fetch(`https://travel-telegram-bot.onrender.com`)
        .catch(error => console.error('Keep-alive ping failed:', error));
    }, 300000); // 5 minutes
  });
};


if (require.main === module) {
  startServer();
}
