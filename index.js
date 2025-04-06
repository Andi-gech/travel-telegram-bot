const ethiopianDate = require('ethiopian-date');
const TelegramBot = require('node-telegram-bot-api');
const {ObjectId } = require('mongodb');
const { format } = require('date-fns');
const Travel=require('./Model/Travel')
const User=require('./Model/Users');
const connectDB = require('./db')


// === Configuration ===
const BOT_TOKEN = '7853908429:AAHs7CJTaDyGCT1ofYmyGMHxXWUZh0Aj378';
const MONGO_URI = 'mongodb+srv://andifab23:tNgwwixDs0Bo5aUj@cluster0.xka9c.mongodb.net/travelBot?retryWrites=true&w=majority&appName=Cluster0';
const ADMIN_ID =[ 445168632,408048964];
const GROUP_CHAT_ID = -1002090187887;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// === Database Connection ===


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
      ['📊 ስታቲስቲክስ', '🏠 Main Menu','Verify Users']
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
  const participants = await User.find({ travelId: travel._id, paymentStatus:"denied"  }).populate('travelId');
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
    message += `**>`;
 
    participants.forEach((p, index) => {
      message += `>${index + 1} ${p.name}  ${p.paymentStatus.toUpperCase()} \n`;
    });

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    console.error('Participants error:', error);
    bot.sendMessage(msg.chat.id, '❌ Error retrieving participants.');
  }
}));

// Stats Handler (Admin)
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
bot.onText(/🏠 Main Menu/, (msg) => {
  const isAdmin = ADMIN_ID.includes(msg.from.id);
  bot.sendMessage(msg.chat.id, '🏠 ወደ ዋና በመመለስ ላይ...', {
    reply_markup: isAdmin ? adminMenu.reply_markup : mainMenu.reply_markup
  });
});
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
  const isAdmin = ADMIN_ID.includes(msg.from.id);

  try {
    const travel = await Travel.findOne({ isActive: true });
    const now = new Date();

    let caption = '✨ *ወደ ቅዱስ ሚካኤል የጉዞ ማህበር እንኳን በደህና መጡ!* ✨\n\n';

    if (!travel) {
      caption += '🚫 በአሁኑ ጊዜ ምንም ጉዞዎች የሉም። በኋላ ተመልሰው ይመልከቱ!';
    } else {
      const startDate = ethiopianDate.toEthiopian(...formatGregorianDates(travel.startDate));
      const endDate = ethiopianDate.toEthiopian(...formatGregorianDates(travel.endDate));
      const nowEthiopian = ethiopianDate.toEthiopian(...formatGregorianDates(now));

      caption += `🏕 *ጉዞ ወደ:* ${bold(travel.name)}\n`;
      caption += `📅 *የምዝገባ ቀን:* ${startDate} - ${endDate}\n\n`;

      if (now < travel.startDate) {
        caption += '🟢 ምዝገባ ክፍት ነው! እባኮትን ለመመዝገብ ከታች ያለውን ሜኑ ይጠቀሙ።';
      } else if (now > travel.endDate) {
        caption += '❌ ይህ የጉዞ ምዝገባ አብቅቷል። ለአዲስ ጉዞ ይከታተሉ!';
      } else {
        caption += '🌍 የጉዞው ቀናት በመካከል ናቸው። እንኳን በሰላም በመንገድ ይሁኑ!';
      }
    }

    const menu = isAdmin
      ? { reply_markup: { keyboard: [...adminMenu.reply_markup.keyboard, ...mainMenu.reply_markup.keyboard], resize_keyboard: true } }
      : mainMenu;

    // 🌄 Your travel image URL or file ID
    const photo = 'https://plus.unsplash.com/premium_photo-1678229915787-d3714c1c3c87?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8b3J0aG9kb3glMjBjaHVyY2h8ZW58MHx8MHx8fDA%3D'; // Or use local fileId

    await bot.sendPhoto(chatId, photo, {
      caption,
      parse_mode: 'Markdown',
      reply_markup: menu.reply_markup
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

      const { name, endDate,AccountName,AccountNo,Price } = state.tempData;

      // Create the new trip in the database
      const newTrip = {
        name,
        startDate: new Date(), // Set to now
        endDate,
        AccountName,
        AccountNo,
        Price,
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
    await User.deleteOne({ _id: new ObjectId(registrationId) });

    deleteMessage(chatId, messageId).catch((error) => {
      console.error('Error deleting message:', error);
    }
    );

    bot.answerCallbackQuery(query.id, { text: '❌ Registration denied!' });
    bot.sendMessage(message.chat.id, `❌ Registration denied for ${registrationId}.`);
    bot.sendMessage(userId, `❌ Registration denied for ${registrationId}.`);
  }
});

// Helper: Validate YYYY-MM-DD format
function isValidDate(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

console.log('🚀 TravelBot is running...');