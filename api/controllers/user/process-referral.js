module.exports = {
  friendlyName: 'Process referral',

  description: '',

  inputs: {
    chatId: {
      type: 'string',
      description: "User's Chat ID",
    },
    referralId: {
      type: 'string',
      description: 'Referral ID',
      allowNull: true,
    },
  },

  exits: {},

  fn: async function ({ chatId, referralId }) {
    const { res } = this
    const botBaseURL = sails.config.custom.botBaseURL

    try {
      // Create New User
      const userRecord = await User.findOne({ chatId })

      let isUnique = false
      let newReferralId

      while (!isUnique) {
        newReferralId = await sails.helpers.genReferralCode()
        const existingUser = await User.findOne({ referralId: newReferralId })
        if (!existingUser) {
          isUnique = true
        }
      }

      if (!userRecord) {
        const user = await sails.helpers.getUser(chatId)
        const profilePicture = await sails.helpers.getProfilePhoto(chatId)

        // Find Refferer User
        const referrerUser = await User.findOne({ referralId })
        const referer = referrerUser.referralId || null

        const userRecord = await User.create({
          firstName: user.first_name,
          lastName: '',
          username: user.username ? user.username : user.first_name,
          chatId: user.id,
          referrer: referer,
          referralId: newReferralId,
          profilePicture,
        }).fetch()

        const owner = userRecord.id
        await Wallet.create({ owner })
        await Activity.create({ owner })
        await Referral.create({ owner: referrerUser.id, user: userRecord })

        // Find Referrer Wallet
        const wallet = await Wallet.findOne({ owner: referrerUser.id })
        await Wallet.updateOne({ owner: referrerUser.id }).set({
          balance: wallet.balance + 5000,
        })

        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: 'Launch OdyStorm',
                web_app: {
                  url: `${botBaseURL}/play?user=${referrerUser.chatId}`,
                },
              },
            ],
          ],
        }

        // Send Message To Referrer
        await sails.helpers.sendMessageCustom(
          referrerUser.chatId,
          `Hi @${referrerUser.username}\nYour buddy @${userRecord.username} just joined the OdyStorm Space Defense and you just received 5000 $ODY.`,
          inlineKeyboard
        )

        // Send Message to New User
        await sails.helpers.sendMessageCustom(
          userRecord.chatId,
          `🌌 Welcome to OdyStorm @${userRecord.username}! 🌌\n\nGreetings, Space Defender! 🚀\nWe’re excited to have you join us. Here’s how to get started:\n\nExplore Missions: Complete tasks to earn $ODY tokens and upgrade your spaceship.💲\n\n\nInvite your friends, family, and colleagues to join the adventure! The more, the merrier—and the more $ODY you'll earn!\nStay Updated: Check out our community for tips and events.\n\nNeed help? Our community is here for you!\n\nWelcome aboard and happy defending! 🌠\nThe OdyStorm Team
          `,
          inlineKeyboard
        )

        return res.status(200).json({
          message: 'Successfully Sign Up User',
        })
      }

      return res.status(200).json({
        message: 'User is already processed and Signed up',
      })
    } catch (error) {
      sails.log.error(error)
      return res.serverError({ message: 'Failed to Sign Up User' })
    }
  },
}
