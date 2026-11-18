const A1=[
['Rencontres','初次见面与自我介绍','在朋友聚会认识新朋友','介绍姓名、国籍、职业，主动询问对方的信息',['étudiant(e)','français(e)','j’habite à…','je travaille…','enchanté(e)'],['Je m’appelle Léa et j’habite à Paris.','Je suis étudiante et j’apprends le français.'],['Et toi, comment tu t’appelles ?','Tu habites où ?','Tu fais quoi dans la vie ?']],
['Portraits','描述人物与购物','在服装店挑选合适的外套','描述颜色、外观、价格，询问尺寸',['bleu','noir','grand','petit','taille M','cher'],['Je cherche une veste bleue.','Vous avez cette veste en taille M ?'],['C’est combien ?','Je peux l’essayer ?','Vous avez une autre couleur ?']],
['Ça se trouve où ?','问路、交通与租房','在巴黎寻找一间出租公寓','描述位置、询问房租与房间配置',['à gauche','à droite','près de','métro','chambre','loyer'],['Je cherche un appartement près du métro.','Je voudrais une chambre avec une fenêtre.'],['C’est à combien de minutes du métro ?','Le loyer est de combien ?','Il y a combien de chambres ?']],
['Au rythme du temps','时间安排与约会','和法国朋友约周末见面','表达日期、时间和安排',['samedi','dimanche','à 15 heures','demain','disponible','rendez-vous'],['Je suis libre samedi après-midi.','On peut se retrouver à quinze heures.'],['Tu es libre dimanche ?','On se retrouve où ?','Ça te va à 15 heures ?']],
['La vie de tous les jours','日常习惯与生活','和室友聊一天的安排','说出日常活动与频率',['le matin','souvent','toujours','se lever','travailler','cuisiner'],['Je me lève à sept heures.','Le soir, je cuisine souvent.'],['Et toi, tu te lèves à quelle heure ?','Tu fais quoi le week-end ?']],
['Vivre avec les autres','请求、邀请与礼貌表达','邀请邻居来家里吃饭','礼貌邀请、接受或拒绝',['inviter','venir','avec plaisir','désolé(e)','ce soir','apporter'],['Tu veux venir dîner chez moi samedi ?','Avec plaisir, merci pour l’invitation !'],['Tu es disponible samedi ?','Je peux apporter quelque chose ?']],
['Un peu, beaucoup…','兴趣爱好与运动','和朋友聊喜欢的运动','说出偏好、频率并反问',['le tennis','la natation','le football','la randonnée','le vélo','le yoga'],['J’aime jouer au tennis le week-end.','Je préfère la natation parce que c’est relaxant.'],['Et toi, tu aimes quel sport ?','Tu joues souvent au tennis ?','Pourquoi tu aimes ça ?']],
['Tout le monde en parle','过去的经历','分享上周末的一次旅行','用简单过去时叙述经历',['hier','la semaine dernière','visiter','aller','manger','voyager'],['Le week-end dernier, je suis allé(e) à Lyon.','J’ai visité un musée et j’ai mangé au restaurant.'],['Et toi, tu as fait quoi ?','Tu as aimé ton week-end ?']],
['On verra bien !','未来计划与愿望','谈论未来工作与旅行计划','表达愿望、近期计划和理由',['demain','l’année prochaine','vouloir','aller','voyager','travailler'],['Je voudrais travailler en France.','L’année prochaine, je vais visiter Bordeaux.'],['Et toi, tu as des projets ?','Tu voudrais habiter où ?']]
];
const extras={A2:[['Au café du quartier','在咖啡馆点餐与闲聊','和常来的咖啡馆店员聊天'],['Chez le médecin','预约与描述身体不适','给诊所打电话预约'],['Colocation','室友沟通与生活习惯','协商打扫卫生'],['Un entretien simple','初步求职对话','介绍自己的经验']],B1:[['Entretien d’embauche','求职面试','回答经验、优势与职业目标'],['Un problème de logement','租房纠纷','向房东说明维修问题'],['Débattre entre amis','朋友间讨论','表达不同观点并举例'],['Au travail','工作协作','提出建议和解释优先级']],B2:[['Entretien approfondi','深度求职面试','用案例说明解决问题能力'],['Négociation','协商与说服','和同事协商项目期限'],['Débat de société','社会议题讨论','提出论点、反驳与让步'],['Vie en France','法国社会与文化','讨论生活方式差异']]};

export const levels = ['A1', 'A2', 'B1', 'B2'];
export const descriptions = { A1: '基础交流', A2: '日常生活', B1: '独立表达', B2: '深入交流' };
export const lessons = Object.fromEntries(levels.map(level => [
  level,
  level === 'A1'
    ? A1.map(([unit, title, scene, goal, vocab, examples, questions]) => ({
        unit, title, scene, goal, vocab, examples, questions
      }))
    : extras[level].map(([title, scene, goal]) => ({
        unit: descriptions[level], title, scene,
        goal: goal + '。主动提出相关问题，并根据对方的回答追问。',
        vocab: ['à mon avis', 'par exemple', 'je voudrais', 'pourriez-vous', 'parce que', 'en revanche'],
        examples: ['Je voudrais vous poser une question.', 'Pour ma part, je préfère cette solution parce que…'],
        questions: ['Et vous, qu’en pensez-vous ?', 'Pourriez-vous préciser ?', 'Quelles sont les autres possibilités ?']
      }))
]));

const openers = {
  A1: 'Bonjour ! On commence ? À toi de parler !',
  A2: 'Bonjour ! Je vous écoute. Vous pouvez aussi me poser une question.',
  B1: 'Bonjour ! Comment souhaitez-vous aborder la situation ?',
  B2: 'Bonjour ! Commençons par votre point de vue sur la situation.'
};

export function demoReply(level, history) {
  const last = history.at(-1)?.content;
  if (!last) return openers[level];
  if (/[?？]/.test(last)) return 'Merci pour ta question. On peut en parler ensemble.';
  return history.length % 4 === 2
    ? 'D’accord, je comprends. À toi de me poser une question si tu veux.'
    : 'Merci, c’est intéressant. Tu peux continuer.';
}
