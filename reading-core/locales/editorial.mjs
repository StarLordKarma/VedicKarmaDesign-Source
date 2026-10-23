// Original editorial additions. Arrays follow the stable sign, planet, house and card orders.
const rows=s=>s.trim().split('\n').map(x=>x.split('|'));
export const EDITORIAL={
en:{
hook:['Make room for what matters: money, love, health and family.','Use your reading to reflect on priorities, prepare for conversations and choose a manageable next step.'],
guide:['New to astrology? Start with your birthday.','Your usual zodiac sign is the Sun sign: the sign the Sun occupied when you were born. These dates are an approximate guide.','Born near a change of sign? The exact sign depends on the year and time of birth. A personal report calculates it from your birth details.','Explore this sign','Get a personal overview · $9.99','Choose a sign to read a short introduction. This does not change your birth details or calculate a personal forecast.'],
months:['January','February','March','April','May','June','July','August','September','October','November','December'],
labels:['In everyday life','What to watch for','Try this','Money and practical choices','Relationships and family','Rest and wellbeing','What this reading covers','How to use your reading','Your sign is only the beginning','A useful question','Possible strength','When it becomes difficult'],
intro:'A birth chart is a picture of the sky at the time of birth. The following sections explain different themes in that picture. Read them as suggestions to compare with your experience, rather than a fixed description of who you must be.',
sign:rows(`A first attempt can help you find out whether an idea works. In a shared project, explain what you want to try before starting.|Speed may make it easy to overlook another person's pace or a hidden cost.|Before saying yes, name the first step, the time it needs and the point at which you will review it.
A regular routine can make saving, learning or caring for a home easier. Progress may be visible through small improvements.|Keeping something familiar can cost more effort than changing it.|Choose one routine to keep and one small adjustment to test for a week.
Comparing opinions can uncover a question nobody has asked. You may enjoy explaining a complex idea in simple words.|Too many conversations or open tasks can scatter your attention.|Write down the main question and finish one small piece before opening another.
Remembering what makes people feel welcome can strengthen a friendship or a shared home.|Helping without asking can leave your own needs unspoken.|Ask what kind of help is wanted, and say what you can realistically offer.
A personal touch can bring warmth to a project, a celebration or time with children.|Praise can start to matter more than whether you enjoy the activity itself.|Make something you like, then invite one specific piece of feedback.
Spotting a missing detail can prevent unnecessary work. A simple checklist may help everyone involved.|A wish to do things well can turn into constant correction of yourself or others.|Agree on what a finished result needs; leave optional improvements for later.
Seeing different viewpoints can help people reach a fair agreement.|Avoiding disagreement may postpone a decision that still needs your answer.|Say what you prefer first, then ask which part can be adjusted together.
A careful question can bring an unspoken agreement into the open and make trust easier.|Uncertainty may tempt you to read too much into a message or test someone's loyalty.|Separate what was said, what you inferred and what you can ask directly.
Learning something new can restore perspective when a task feels too narrow.|A promising possibility can make everyday limits seem unimportant.|Describe the larger goal and one affordable way to explore it before committing.
A realistic sequence of steps can turn a long project into work you can actually finish.|Responsibility can become a habit of carrying work that belongs to other people.|List your own commitments, delegate one shared task and reserve time to rest.
An unusual suggestion may solve a problem that familiar methods have left untouched.|A good idea can overlook how much change other people can take on.|Test the idea with the people affected and ask what would make it easier to use.
Imagination can help you notice a feeling or find words for an experience.|Feeling another person's distress can make it hard to tell where your responsibility ends.|Name your feeling, check the facts and choose a limit that leaves room for care.`),
planet:rows(`Identity and direction|Choosing a goal because it matters to you can feel different from choosing it to meet an expectation.|Which decision would still matter if nobody praised it?
Comfort and emotional habits|A tense day may bring back a familiar response, such as withdrawing or seeking reassurance.|What helps me feel supported without expecting someone else to guess?
Thinking and communication|A disagreement may come from different meanings of the same word, rather than opposing intentions.|Which detail or question would prevent a misunderstanding?
Values and closeness|The way you spend time or show appreciation can reveal a preference that has not been discussed.|How could I state my preference while leaving room for another answer?
Action and boundaries|Starting a task and saying no both require a clear idea of where to put your effort.|Where do I need a first step, and where do I need a stopping point?
Learning and possibilities|A larger plan becomes useful when you can compare the benefits with the time and resources it needs.|What small experience would teach me whether this plan fits?
Commitments and limits|A promise is easier to keep when its deadline, scope and support are agreed.|What can I realistically take responsibility for now?
Change and independence|A small trial can show whether a different method improves everyday life.|What could I change temporarily before making it permanent?
Imagination and uncertainty|An inspiring possibility and a confirmed fact can both matter, but they play different roles.|What do I know, and what still needs checking?
Deep change and shared influence|An old arrangement may need a new conversation about who decides and who carries the consequences.|What can I influence, and what decision belongs to someone else?`),
house:rows(`Notice how you enter an unfamiliar room or begin a conversation. You can adjust an introduction without changing your whole personality.|What helps me make a comfortable first contact?
Look at time, belongings and available money together. A useful decision fits your actual resources, not an ideal picture of them.|What can I afford in money, time and effort?
Choose one everyday conversation to make clearer. A short message with a specific request often works better than hints.|What does the other person need to understand?
Home can mean a place, a relationship or a reliable routine. Ask which part needs practical attention now.|Which small agreement would make home life easier?
Enjoyment does not need to become a performance. Make space for a hobby, play or a creative experiment without judging its value too soon.|What would I enjoy doing for its own sake?
Review an ordinary day: work, meals, breaks and unfinished tasks. Choose a workable adjustment; this section does not assess your health.|Which routine could become simpler?
A partnership needs room for both people's expectations. Put one assumption into words and ask whether you share it.|What have we agreed, and what have we only assumed?
Make shared responsibilities visible before promising more. Clarify access, permission and expectations around a common resource.|Who is responsible for which part?
A wider view may come from a course, a book or listening to another experience. Compare the idea with what you can observe.|Which belief am I willing to examine?
A public role can include employment, study or unpaid responsibility. Define success in terms you can check, rather than a title alone.|What would progress look like in practice?
A group works better when membership, contribution and boundaries are clear. You can belong without being available all the time.|Where is my contribution wanted and sustainable?
A quiet period can help close an unfinished task or recover attention. Time alone is useful when you can also reach support.|What can I finish or put down for now?`),
aspect:rows(`Two themes are emphasised together. For example, a wish for closeness may become linked with the need to be heard. Notice both before reacting.|Name each need separately before choosing an action.
A possible opening still needs attention. A helpful conversation or resource may be easy to miss if you wait for everything to happen by itself.|Choose one invitation, question or small experiment.
Two priorities may compete for the same time or energy. Tension can point to a limit or an agreement that needs changing.|Reduce the next step and decide which priority comes first today.
A familiar strength may make something easier. Ease does not guarantee an outcome, and a comfortable habit can still need updating.|Use what already works, then check whether it fits this situation.
Different needs may seem to pull in opposite directions. A relationship can make the difference visible without making either person the problem.|Describe both viewpoints and look for a workable boundary.`),
major:rows(`A beginning benefits from a light test: ask what is safe to try and what you need to learn first.|Avoid treating enthusiasm as a substitute for preparation.
A useful resource may already be available: a skill, a contact or a tool you have not used.|Choose a concrete task instead of promising more than you can deliver.
A pause can reveal a detail you missed in a hurry. Give yourself room to notice it and then check it.|Silence is not evidence of what another person is thinking.
Something you value may need patient care: an idea, a relationship or the practical conditions of daily life.|Offering care does not require taking over every responsibility.
A clear arrangement can reduce uncertainty. Discuss who decides, who does the work and when you will review it.|Structure becomes unhelpful when it prevents a reasonable question.
An experienced person or established method may offer a useful starting point.|A rule deserves review when circumstances have changed.
An important choice can show what you value. Compare your wishes with the agreement you can honestly make.|Harmony is easier to maintain when differences can be spoken about.
Progress begins with a direction you can describe. Check which parts of the journey are actually under your control.|Pushing harder may not solve a disagreement about the destination.
A calm boundary can protect both dignity and a relationship. You can be firm without proving your strength.|Staying composed does not mean accepting disrespect.
Time away from noise may help you recognise your own view. Decide when and with whom you want to discuss it.|Solitude should leave a route back to support.
A change of circumstances invites you to review the plan. Keep an alternative that does not depend on perfect timing.|The card does not promise a lucky turn or a financial gain.
A balanced decision needs facts, agreements and a chance for each person to be heard.|Feeling certain is not the same as having enough evidence.
A pause can be active: gather a missing detail or consider a viewpoint you have not tried.|Waiting becomes costly when there is no reason or review date.
Closing a stage can include grief and relief at the same time. Choose what needs finishing and what support the transition needs.|The image does not predict a death or require a sudden break.
Combining two workable approaches may help more than choosing an extreme. Adjust the pace and observe the result.|Balance is personal; the same routine will not suit every day.
Notice an arrangement you continue mainly through pressure, habit or fear of losing approval.|Do not use the card as a label for another person or proof of a curse.
When an assumption is challenged, check what is still reliable before deciding what needs rebuilding.|The image does not establish that a crisis will happen.
Hope becomes practical through something small you can do or receive today.|You do not need to feel optimistic all the time to move forward.
Unclear messages can make imagined explanations feel convincing. Ask a direct question when it is appropriate.|A strong feeling does not confirm deception or a hidden threat.
A good result deserves recognition. Name what worked so that you can use the lesson again.|Enjoyment can coexist with a realistic look at unfinished work.
Returning to an old question with more experience can lead to a fairer answer.|Reviewing a decision does not require judging your whole life.
A completed stage offers knowledge you can carry forward. Recognise the people and steps that helped.|Completion does not mean that everything must now be perfect.`),
rank:rows(`A beginning is available, but its scale is still small. Name what would make it practical.|Do not confuse an opening with a guaranteed result.
Two needs or people are involved. Check where there is agreement and where a choice is still needed.|Silence can hide different expectations.
Something can develop through contribution, practice or support from others.|Agree on roles before assuming everyone means the same thing.
A pause or stable arrangement offers a chance to assess what you have.|Comfort can become avoidance when the situation needs an answer.
A difficulty asks for a specific response rather than a judgement about your whole future.|Name the problem and one reachable source of help.
An exchange with others may show where support or recognition is useful.|Check whether giving and receiving are voluntary and fair.
There are options to compare. Look at evidence, effort and likely consequences.|An attractive explanation may still need checking.
A change of direction may involve practice, movement or leaving an old approach.|Decide what you are moving towards, not only what you want to escape.
Experience has accumulated. Recognise both the result and the effort it has required.|Leave room for recovery and a different next step.
A pattern has reached a limit or a point of completion. Decide what to keep and what to stop repeating.|One difficult ending does not determine every future outcome.
A learner's approach can help: ask, observe and try a task you can finish.|You do not need certainty or expertise before asking a clear question.
Energy is moving towards a goal. Check the pace, direction and effect on other people.|Speed is useful only when the agreement and destination are clear.
A receptive, considered response may help more than an immediate answer.|Caring for someone includes limits and respect for your own needs.
A decision needs responsibility for resources, standards and consequences.|Authority does not remove the need to listen or revise a plan.`),
suit:rows(`Cups concern feelings, closeness and emotional expectations. Ask what has been expressed and what is still being guessed.|An everyday example is agreeing how to support each other after a difficult day.
Pentacles concern practical support: money, time, skills, home and shared work. Begin with what is actually available.|An everyday example is making a realistic list of costs and responsibilities before a shared purchase.
Swords concern thoughts, words and decisions. Separate an observation from the story you have built around it.|An everyday example is checking the meaning of a short message before answering in anger.
Wands concern initiative, motivation and the way you use energy. Look for a goal and a pace you can sustain.|An everyday example is testing a new project on a small scale before accepting every task.`)
},
ru:{
hook:['Деньги, любовь, забота о здоровье и семье — начните с того, что важно вам.','Используйте отчёт, чтобы обдумать приоритеты, подготовиться к разговору и выбрать посильный следующий шаг.'],
guide:['Не знакомы с астрологией? Начните с даты рождения.','Обычно под знаком зодиака понимают знак, в котором находилось Солнце в момент рождения. Даты ниже — приблизительный ориентир.','Родились рядом с границей знаков? Точный знак зависит от года и времени рождения. Личный отчёт рассчитывает его по вашим данным.','Узнать о знаке','Получить личный обзор · $9.99','Выберите знак для короткого знакомства. Это не меняет данные рождения и не рассчитывает личный прогноз.'],
months:['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'],
labels:['Как это бывает в жизни','На что обратить внимание','Что можно попробовать','Деньги и повседневные решения','Отношения и семья','Отдых и забота о себе','О чём этот отчёт','Как пользоваться отчётом','Знак зодиака — только начало','Полезный вопрос','Возможная сильная сторона','Когда возникают трудности'],
intro:'Карта рождения — это схема неба на момент рождения. Разделы ниже объясняют разные темы этой схемы. Сопоставляйте их со своим опытом: это повод подумать о себе, а не обязательное описание того, каким вам нужно быть.',
sign:rows(`Небольшая попытка помогает понять, работает ли идея. В общем деле полезно сначала объяснить, что именно вы хотите попробовать.|Из-за спешки легко не заметить чужой темп или дополнительные расходы.|Прежде чем соглашаться, назовите первый шаг, время на него и момент, когда оцените результат.
Постоянный ритм помогает копить, учиться или заботиться о доме. Результат складывается из небольших улучшений.|На сохранение привычного иногда уходит больше сил, чем на перемены.|Выберите одну полезную привычку и одно небольшое изменение на ближайшую неделю.
Разные мнения помогают заметить вопрос, который раньше никто не задавал. Вам может нравиться объяснять сложное простыми словами.|Множество разговоров и незавершённых дел рассеивают внимание.|Запишите главный вопрос и завершите небольшую часть дела, прежде чем открывать следующую.
Внимание к тому, что даёт людям чувство уюта, помогает дружбе и домашней жизни.|Помогая без просьбы, легко не сказать о собственных потребностях.|Спросите, какая помощь нужна, и честно обозначьте, что можете предложить.
Личный замысел добавляет тепла проекту, празднику или времени с детьми.|Похвала может стать важнее удовольствия от самого занятия.|Создайте то, что нравится вам, и попросите один конкретный отзыв.
Замеченная деталь может уберечь от лишней работы. Простой список действий помогает всем участникам.|Желание сделать хорошо иногда превращается в постоянную критику себя и других.|Договоритесь, без чего результат нельзя считать готовым; необязательные улучшения оставьте на потом.
Умение видеть разные стороны помогает прийти к справедливой договорённости.|Избегая разногласий, можно надолго отложить собственное решение.|Сначала назовите своё предпочтение, затем спросите, что можно согласовать вместе.
Внимательный вопрос помогает обсудить негласную договорённость и укрепить доверие.|Неопределённость может побуждать искать скрытый смысл в сообщении или проверять чужую верность.|Разделите сказанное, свои догадки и то, о чём можно спросить прямо.
Новое знание помогает увидеть больше возможностей, когда задача кажется слишком узкой.|За привлекательной идеей легко не заметить ограничения повседневной жизни.|Назовите большую цель и недорогой способ проверить идею до серьёзных обязательств.
Понятная последовательность шагов превращает большой проект в выполнимую работу.|Ответственность иногда становится привычкой выполнять чужую работу.|Перечислите свои обязательства, распределите одно общее дело и оставьте время на отдых.
Необычное предложение может решить задачу, с которой не справлялись привычные способы.|Даже хорошая идея может не учитывать, сколько перемен готовы принять другие люди.|Обсудите пробный вариант с теми, кого он касается, и спросите, что сделает его удобнее.
Воображение помогает заметить чувство или подобрать слова к переживанию.|Чужое расстройство иногда мешает понять, где заканчивается ваша ответственность.|Назовите своё чувство, проверьте факты и обозначьте границу, которая оставляет место для заботы.`),
planet:rows(`Личное направление|Цель, выбранная по собственному желанию, может ощущаться иначе, чем цель ради чужого одобрения.|Какое решение важно мне, даже если за него не похвалят?
Чувства и привычные реакции|Напряжённый день может вернуть привычную реакцию: замкнуться или искать подтверждение, что всё в порядке.|Как попросить о поддержке, не ожидая, что другой человек догадается сам?
Мысли и общение|Разногласие иногда возникает из-за разного смысла одного слова, а не из-за противоположных намерений.|Какой вопрос поможет избежать недоразумения?
Ценности и близость|То, как вы проводите время или выражаете благодарность, может показать ещё не обсуждённое предпочтение.|Как назвать своё желание и оставить место для другого ответа?
Действие и границы|И начать дело, и сказать «нет» проще, когда понятно, на что вы готовы тратить силы.|Где нужен первый шаг, а где — момент остановки?
Обучение и возможности|Большой план становится полезнее, когда его пользу можно сравнить с затратами времени и ресурсов.|Какой небольшой опыт покажет, подходит ли мне этот план?
Обязательства и ограничения|Обещание легче выполнить, когда согласованы срок, объём работы и необходимая помощь.|За что я действительно могу отвечать сейчас?
Перемены и самостоятельность|Небольшая проба покажет, делает ли новый способ повседневную жизнь удобнее.|Что можно временно изменить до окончательного решения?
Воображение и неопределённость|Вдохновляющая возможность и подтверждённый факт могут быть важны одновременно, но по-разному.|Что я знаю точно, а что ещё нужно проверить?
Глубокие перемены и общее влияние|Старая договорённость может требовать нового разговора о том, кто принимает решения и отвечает за последствия.|На что я могу повлиять, а что решает другой человек?`),
house:rows(`Заметьте, как вы начинаете разговор или ведёте себя в незнакомом месте. Способ знакомства можно изменить, не меняя всю свою личность.|Что помогает мне спокойно установить первый контакт?
Посмотрите вместе на время, имущество и доступные деньги. Полезное решение соответствует реальным возможностям, а не идеальной картине.|Что я могу позволить себе по деньгам, времени и силам?
Сделайте понятнее один повседневный разговор. Короткое сообщение с конкретной просьбой часто полезнее намёков.|Что именно нужно понять собеседнику?
Домом может быть место, отношения или надёжный распорядок. Спросите, какая часть сейчас нуждается в практическом внимании.|Какая маленькая договорённость облегчит домашнюю жизнь?
Удовольствие не обязательно должно становиться выступлением. Оставьте место для увлечения, игры или творческой пробы без немедленной оценки.|Что мне приятно делать ради самого занятия?
Посмотрите на обычный день: работу, еду, перерывы и незавершённые задачи. Выберите посильное изменение; этот раздел не оценивает здоровье.|Какую привычную задачу можно упростить?
В партнёрстве важно место для ожиданий обоих людей. Назовите одно предположение и спросите, согласен ли с ним другой человек.|О чём мы договорились, а что только предположили?
Прежде чем обещать больше, сделайте общие обязанности понятными. Уточните доступ, разрешения и ожидания вокруг общего ресурса.|Кто отвечает за каждую часть?
Более широкий взгляд можно найти в книге, на занятии или в чужом опыте. Сравнивайте идею с тем, что можете наблюдать.|Какое убеждение я готов пересмотреть?
Общественная роль — это работа, учёба или неоплачиваемая ответственность. Опишите успех через заметный результат, а не только название должности.|Как будет выглядеть реальный прогресс?
В группе полезно понимать, кто участвует, что вносит и где его границы. Для принадлежности не нужна постоянная доступность.|Где мой вклад нужен и посилен?
Спокойное время помогает завершить отложенное дело или восстановить внимание. Уединение полезнее, когда остаётся возможность обратиться за поддержкой.|Что можно закончить или пока отложить?`),
aspect:rows(`Две темы выделяются одновременно. Например, желание близости может соединиться с потребностью быть услышанным. Прежде чем отвечать, заметьте обе.|Назовите каждую потребность отдельно и только потом выбирайте действие.
Возможность всё равно требует внимания. Полезный разговор или ресурс легко пропустить, если ждать, что всё произойдёт само.|Выберите приглашение, вопрос или небольшую пробу.
Две важные задачи могут требовать одного и того же времени или сил. Напряжение помогает заметить ограничение или договорённость, которую пора изменить.|Уменьшите следующий шаг и решите, что сегодня важнее.
Знакомое умение может облегчить задачу. Лёгкость не гарантирует результат, а удобная привычка иногда нуждается в обновлении.|Используйте то, что уже получается, и проверьте, подходит ли это к ситуации.
Разные потребности могут тянуть в противоположные стороны. Отношения делают различие заметным, но не превращают кого-то одного в проблему.|Опишите обе позиции и найдите посильную границу.`),
major:rows(`Началу полезна небольшая проба: что безопасно попробовать и чему нужно сначала научиться?|Воодушевление не заменяет подготовку.
Полезный ресурс может уже быть рядом: навык, знакомый человек или инструмент, который вы пока не использовали.|Выберите конкретную задачу вместо обещания сделать больше, чем сможете.
Пауза помогает заметить деталь, которую пропустили в спешке. Дайте себе время увидеть её и затем проверить.|Молчание не доказывает, что думает другой человек.
Ценному делу может требоваться терпеливая забота: идее, отношениям или бытовым условиям.|Заботиться не значит брать на себя все обязанности.
Понятная договорённость уменьшает неопределённость. Обсудите, кто решает, кто делает и когда вы оцените результат.|Порядок мешает, если не позволяет задать разумный вопрос.
Опытный человек или проверенный способ могут дать полезную отправную точку.|Правило стоит пересмотреть, если обстоятельства изменились.
Важный выбор показывает, что вы цените. Сравните желания с договорённостью, которую действительно готовы соблюдать.|Согласие проще поддерживать, когда можно говорить о различиях.
Движение начинается с понятного направления. Проверьте, какие части пути действительно зависят от вас.|Больше усилий не всегда решает спор о том, куда идти.
Спокойная граница помогает сохранить достоинство и отношения. Можно быть твёрдым без доказательства своей силы.|Спокойствие не обязывает терпеть неуважение.
Время без лишнего шума помогает услышать собственное мнение. Решите, когда и с кем вы хотите его обсудить.|Уединение должно оставлять путь к поддержке.
Перемена обстоятельств — повод пересмотреть план. Сохраните запасной вариант, не требующий идеального момента.|Карта не обещает удачу или денежный выигрыш.
Взвешенному решению нужны факты, договорённости и возможность высказаться каждому.|Уверенность в своей правоте не равна достаточным доказательствам.
Пауза может быть деятельной: найдите недостающую информацию или попробуйте другой взгляд.|Ожидание обходится дорого, когда нет причины ждать и срока пересмотра.
Завершение этапа может приносить и грусть, и облегчение. Решите, что нужно закончить и какая поддержка поможет.|Образ не предсказывает смерть и не требует резкого разрыва.
Сочетание двух подходящих способов иногда полезнее крайности. Измените темп и посмотрите на результат.|Равновесие индивидуально: один распорядок не подходит на каждый день.
Заметьте договорённость, которую поддерживаете главным образом из-за давления, привычки или страха потерять одобрение.|Не используйте карту как ярлык для человека или доказательство проклятия.
Если привычное объяснение перестало работать, сначала проверьте, на что ещё можно опереться.|Образ не устанавливает, что обязательно произойдёт кризис.
Надежда становится ощутимее через небольшое действие или поддержку, которую можно принять сегодня.|Для движения вперёд не обязательно постоянно чувствовать оптимизм.
Неясное сообщение может сделать придуманное объяснение убедительным. При возможности задайте прямой вопрос.|Сильное чувство не доказывает обман или скрытую угрозу.
Хороший результат заслуживает признания. Назовите, что сработало, чтобы сохранить полезный опыт.|Радость совместима с вниманием к незавершённым делам.
Возвращение к старому вопросу с новым опытом помогает ответить справедливее.|Пересмотр решения не требует выносить приговор всей своей жизни.
Завершённый этап даёт опыт для следующего. Заметьте людей и действия, которые помогли.|Завершённость не требует, чтобы всё стало идеальным.`),
rank:rows(`Начало возможно, но его масштаб пока невелик. Назовите, что сделает его осуществимым.|Возможность ещё не гарантирует результат.
Участвуют две потребности или два человека. Уточните, где уже есть согласие, а где ещё предстоит выбор.|За молчанием могут скрываться разные ожидания.
Дело развивается через вклад, практику или помощь других людей.|Уточните роли до предположения, что все понимают задачу одинаково.
Пауза или устойчивый порядок дают возможность оценить то, что у вас есть.|Удобство становится избеганием, если ситуация требует ответа.
Трудности нужен конкретный ответ, а не оценка всего будущего.|Назовите проблему и один доступный источник помощи.
Обмен с другими показывает, где нужны поддержка или признание.|Проверьте, добровольно и справедливо ли устроен обмен.
Есть варианты для сравнения. Посмотрите на факты, усилия и возможные последствия.|Привлекательное объяснение всё равно нуждается в проверке.
Смена направления может требовать практики, движения или отказа от старого способа.|Решите, к чему идёте, а не только от чего хотите уйти.
Опыт уже накоплен. Признайте и результат, и потраченные силы.|Оставьте место для восстановления и другого следующего шага.
Привычная история дошла до предела или завершения. Решите, что сохранить и что перестать повторять.|Один трудный финал не определяет все будущие результаты.
Полезна позиция ученика: спросить, понаблюдать и попробовать выполнимую задачу.|Для ясного вопроса не обязательно всё знать заранее.
Усилия направлены к цели. Проверьте темп, направление и влияние на других людей.|Скорость полезна, когда понятны договорённость и цель.
Внимательный ответ может помочь больше, чем немедленная реакция.|Забота о другом включает границы и внимание к своим потребностям.
Решение требует ответственности за ресурсы, правила и последствия.|Право решать не отменяет необходимости слушать и менять план.`),
suit:rows(`Кубки связаны с чувствами, близостью и эмоциональными ожиданиями. Спросите, что уже высказано, а о чём пока только догадываются.|Бытовой пример: договориться, как поддержать друг друга после трудного дня.
Пентакли связаны с практической опорой: деньгами, временем, навыками, домом и общим трудом. Начните с реально доступного.|Бытовой пример: составить список расходов и обязанностей перед общей покупкой.
Мечи связаны с мыслями, словами и решениями. Отделите наблюдение от объяснения, которое вы ему дали.|Бытовой пример: уточнить смысл короткого сообщения до раздражённого ответа.
Жезлы связаны с инициативой, интересом и расходованием сил. Ищите цель и посильный темп.|Бытовой пример: проверить новый проект в небольшом масштабе до принятия всех задач.`)
},
es:{
hook:['Dinero, amor, salud y familia: empieza por lo que te importa.','Usa tu lectura para pensar en tus prioridades, preparar una conversación y elegir un próximo paso a tu alcance.'],
guide:['¿No conoces la astrología? Empieza por tu fecha de nacimiento.','Tu signo habitual es el signo solar: donde estaba el Sol cuando naciste. Estas fechas son una orientación aproximada.','¿Naciste cerca de un cambio de signo? El signo exacto depende del año y la hora de nacimiento. El informe personal lo calcula con tus datos.','Conocer este signo','Obtener un análisis personal · $9.99','Elige un signo para leer una introducción. Esto no cambia tus datos ni calcula un pronóstico personal.'],
months:['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],
labels:['En la vida cotidiana','En qué fijarte','Qué puedes probar','Dinero y decisiones prácticas','Relaciones y familia','Descanso y bienestar','Qué incluye esta lectura','Cómo usar tu informe','Tu signo es solo el principio','Una pregunta útil','Un posible punto fuerte','Cuando surgen dificultades'],
intro:'Una carta natal es un esquema del cielo en el momento del nacimiento. Las secciones siguientes explican sus distintos temas. Compáralos con tu experiencia: son ideas para reflexionar, no una descripción fija de cómo debes ser.',
sign:rows(`Una prueba pequeña ayuda a saber si una idea funciona. En un proyecto compartido, explica primero qué quieres probar.|La prisa puede ocultar el ritmo de otra persona o un coste adicional.|Define el primer paso, el tiempo necesario y cuándo revisarás el resultado.
Una rutina estable puede facilitar el ahorro, el aprendizaje o el cuidado del hogar. Los avances se ven en pequeñas mejoras.|Mantener lo conocido a veces cuesta más que cambiarlo.|Conserva una rutina útil y prueba un ajuste pequeño durante una semana.
Comparar opiniones permite descubrir una pregunta nueva. Puede gustarte explicar lo complejo con palabras sencillas.|Demasiadas conversaciones o tareas abiertas dispersan la atención.|Anota la pregunta principal y termina una parte antes de abrir otra.
Recordar qué hace sentir acogidas a las personas ayuda a la amistad y al hogar.|Ayudar sin preguntar puede dejar tus propias necesidades sin expresar.|Pregunta qué ayuda se necesita y di qué puedes ofrecer de verdad.
Un toque personal aporta calidez a un proyecto, una celebración o el tiempo con niños.|Los elogios pueden importar más que disfrutar de la actividad.|Crea algo que te guste y pide una opinión concreta.
Detectar un detalle puede evitar trabajo innecesario. Una lista sencilla ayuda al equipo.|El deseo de hacerlo bien puede convertirse en crítica constante.|Acordad qué necesita el resultado para estar terminado; dejad mejoras opcionales para después.
Ver distintos puntos de vista ayuda a llegar a un acuerdo justo.|Evitar el desacuerdo puede retrasar una decisión que necesita tu respuesta.|Di primero qué prefieres y pregunta después qué podéis ajustar.
Una pregunta cuidadosa permite hablar de un acuerdo implícito y reforzar la confianza.|La incertidumbre puede llevarte a buscar sentidos ocultos o poner a prueba la lealtad.|Separa lo dicho, tu interpretación y lo que puedes preguntar directamente.
Aprender algo nuevo devuelve perspectiva cuando una tarea parece estrecha.|Una posibilidad atractiva puede hacer olvidar los límites cotidianos.|Nombra la meta y una forma asequible de explorarla antes de comprometerte.
Una secuencia realista convierte un proyecto largo en trabajo que puedes terminar.|La responsabilidad puede convertirse en hacer el trabajo de otros.|Enumera tus compromisos, reparte una tarea común y reserva descanso.
Una propuesta distinta puede resolver un problema que seguía abierto.|Una buena idea puede ignorar cuánto cambio pueden asumir los demás.|Prueba la propuesta con las personas afectadas y pregunta cómo hacerla más útil.
La imaginación ayuda a reconocer un sentimiento o encontrar palabras para una experiencia.|El malestar ajeno puede dificultar ver dónde termina tu responsabilidad.|Nombra tu emoción, comprueba los hechos y elige un límite que permita cuidar.`),
planet:rows(`Identidad y dirección|Una meta elegida por interés propio puede sentirse distinta de otra elegida para cumplir expectativas.|¿Qué decisión me importaría sin recibir elogios?
Necesidades emocionales|Un día tenso puede activar la costumbre de aislarte o buscar tranquilidad en otra persona.|¿Cómo puedo pedir apoyo sin esperar que lo adivinen?
Pensamiento y comunicación|Un desacuerdo puede surgir de dar sentidos distintos a una palabra.|¿Qué pregunta evitaría un malentendido?
Valores y cercanía|El tiempo que compartes o la forma de agradecer pueden mostrar una preferencia aún no hablada.|¿Cómo expresar mi deseo dejando espacio a otra respuesta?
Acción y límites|Empezar y decir que no requieren saber dónde quieres poner tu esfuerzo.|¿Dónde necesito empezar y dónde detenerme?
Aprendizaje y posibilidades|Un plan grande resulta útil al comparar su beneficio con el tiempo y los recursos necesarios.|¿Qué experiencia pequeña me diría si este plan encaja?
Compromisos y límites|Una promesa es más fácil de cumplir con plazo, alcance y ayuda acordados.|¿De qué puedo hacerme responsable ahora?
Cambio e independencia|Una prueba pequeña muestra si otro método mejora la vida cotidiana.|¿Qué puedo cambiar temporalmente antes de decidir?
Imaginación e incertidumbre|Una posibilidad inspiradora y un hecho confirmado tienen funciones distintas.|¿Qué sé y qué falta comprobar?
Cambios profundos y decisiones compartidas|Un acuerdo antiguo puede necesitar otra conversación sobre quién decide y asume consecuencias.|¿Qué puedo influir y qué le corresponde a otra persona?`),
house:rows(`Observa cómo empiezas una conversación o llegas a un lugar nuevo. Puedes ajustar la presentación sin cambiar tu personalidad.|¿Qué facilita un primer contacto tranquilo?
Mira juntos el tiempo, los bienes y el dinero disponible. Una decisión útil se adapta a tus recursos reales.|¿Qué puedo asumir en dinero, tiempo y esfuerzo?
Aclara una conversación cotidiana. Una petición concreta suele servir más que una indirecta.|¿Qué necesita entender la otra persona?
El hogar puede ser un lugar, un vínculo o una rutina fiable. Pregunta qué necesita atención práctica.|¿Qué acuerdo pequeño facilitaría la convivencia?
Disfrutar no necesita convertirse en una actuación. Da espacio al juego o a una afición sin juzgar su valor enseguida.|¿Qué me gustaría hacer por el placer de hacerlo?
Revisa un día habitual: trabajo, comidas, pausas y tareas pendientes. Elige un ajuste viable; esta sección no evalúa tu salud.|¿Qué rutina puedo simplificar?
Una relación necesita espacio para las expectativas de ambos. Expresa una suposición y pregunta si es compartida.|¿Qué hemos acordado y qué solo hemos supuesto?
Aclara las responsabilidades comunes antes de prometer más. Revisa permisos, acceso y expectativas sobre un recurso compartido.|¿Quién responde de cada parte?
Un curso, un libro u otra experiencia pueden ampliar tu mirada. Compara la idea con lo observable.|¿Qué creencia estoy dispuesto a revisar?
Un papel público puede incluir trabajo, estudios o tareas sin remunerar. Define el éxito mediante un resultado comprobable.|¿Cómo se vería el progreso en la práctica?
Un grupo funciona mejor con aportaciones y límites claros. Pertenecer no exige estar siempre disponible.|¿Dónde es útil y sostenible mi aportación?
Un tiempo tranquilo permite cerrar una tarea o recuperar atención. La soledad ayuda cuando el apoyo sigue accesible.|¿Qué puedo terminar o dejar por ahora?`),
aspect:rows(`Dos temas se destacan a la vez. Por ejemplo, la cercanía puede vincularse a la necesidad de ser escuchado.|Nombra cada necesidad por separado antes de actuar.
Una oportunidad necesita atención. Una conversación útil puede pasar desapercibida si esperas que todo ocurra solo.|Elige una pregunta, invitación o prueba pequeña.
Dos prioridades pueden competir por el mismo tiempo. La tensión puede señalar un límite o un acuerdo por revisar.|Reduce el paso y decide qué va primero hoy.
Una capacidad conocida facilita la tarea. La facilidad no garantiza resultados y una costumbre cómoda puede necesitar cambios.|Usa lo que funciona y comprueba si sirve aquí.
Distintas necesidades pueden tirar en sentidos opuestos. Una relación muestra esa diferencia sin convertir a nadie en el problema.|Describe ambas posiciones y busca un límite viable.`),
major:rows(`Un comienzo se beneficia de una prueba pequeña y de saber qué necesitas aprender.|El entusiasmo no sustituye la preparación.
Puede haber un recurso a mano: una habilidad, una persona o una herramienta aún sin usar.|Elige una tarea concreta sin prometer más de lo posible.
Una pausa permite ver un detalle que la prisa ocultó. Después conviene comprobarlo.|El silencio no demuestra qué piensa otra persona.
Una idea, una relación o las condiciones de vida pueden necesitar atención paciente.|Cuidar no exige asumir todas las responsabilidades.
Un acuerdo claro reduce la incertidumbre: quién decide, quién hace y cuándo revisar.|La estructura deja de ayudar si impide preguntar.
Una persona con experiencia o un método conocido ofrecen un punto de partida.|Revisa la regla cuando cambian las circunstancias.
Una elección importante muestra tus valores. Compara deseos y compromisos que puedes cumplir.|La armonía necesita poder hablar de las diferencias.
Avanzar empieza por una dirección clara y por reconocer qué depende de ti.|Más esfuerzo no siempre resuelve el desacuerdo sobre el destino.
Un límite tranquilo protege la dignidad y la relación sin demostrar fuerza.|La calma no obliga a aceptar faltas de respeto.
Alejarte del ruido ayuda a reconocer tu opinión y elegir con quién hablarla.|La soledad debe dejar un camino al apoyo.
El cambio de circunstancias invita a revisar el plan y conservar una alternativa.|La carta no promete suerte ni ganancias.
Una decisión equilibrada necesita hechos, acuerdos y escuchar a cada persona.|Sentir certeza no equivale a tener pruebas suficientes.
Una pausa puede ser activa: buscar información o mirar desde otro ángulo.|Esperar cuesta cuando no hay motivo ni fecha de revisión.
Cerrar una etapa puede traer tristeza y alivio. Decide qué terminar y qué apoyo necesitas.|La imagen no predice una muerte ni exige una ruptura repentina.
Combinar dos enfoques útiles puede ayudar más que ir a un extremo.|El equilibrio es personal y cambia según el día.
Observa un acuerdo que mantienes por presión, costumbre o miedo a perder aprobación.|No uses la carta como etiqueta ni como prueba de una maldición.
Si una suposición se cuestiona, comprueba primero qué sigue siendo fiable.|La imagen no establece que vaya a ocurrir una crisis.
La esperanza se hace práctica con un gesto pequeño o con apoyo que puedes recibir hoy.|No necesitas sentir optimismo todo el tiempo para avanzar.
Un mensaje confuso hace convincentes algunas historias imaginadas. Pregunta directamente si es adecuado.|Un sentimiento fuerte no prueba engaño ni amenaza oculta.
Reconoce un buen resultado y nombra lo que funcionó para aprender de ello.|Disfrutar es compatible con atender lo pendiente.
Volver a una pregunta con más experiencia permite una respuesta más justa.|Revisar una decisión no exige juzgar toda tu vida.
Una etapa terminada deja experiencia para la siguiente. Reconoce personas y pasos que ayudaron.|Terminar no significa que todo deba ser perfecto.`),
rank:rows(`Hay un comienzo posible, aún pequeño. Nombra qué lo haría práctico.|Una oportunidad no es un resultado garantizado.
Hay dos necesidades o personas. Comprueba el acuerdo y la elección pendiente.|El silencio puede ocultar expectativas distintas.
Algo se desarrolla mediante aportaciones, práctica o ayuda.|Aclarad los papeles antes de dar por hecha una visión común.
Una pausa o un orden estable permiten valorar lo que tienes.|La comodidad puede convertirse en evitar una respuesta necesaria.
Una dificultad pide una respuesta concreta, no un juicio sobre todo el futuro.|Nombra el problema y una ayuda accesible.
Un intercambio muestra dónde son útiles el apoyo o el reconocimiento.|Comprueba que dar y recibir sean voluntarios y justos.
Hay opciones que comparar con hechos, esfuerzo y consecuencias.|Una explicación atractiva también necesita revisión.
Un cambio de rumbo puede requerir práctica o dejar un método anterior.|Define hacia dónde vas, no solo de qué huyes.
Se ha acumulado experiencia. Reconoce el resultado y el esfuerzo.|Deja espacio para recuperarte y dar otro paso.
Una historia llega a un límite o cierre. Decide qué guardar y qué no repetir.|Un final difícil no determina todos los resultados futuros.
Ayuda aprender: preguntar, observar y probar una tarea terminable.|No necesitas saberlo todo para preguntar con claridad.
La energía se dirige a una meta. Revisa ritmo, dirección y efecto en otros.|La velocidad ayuda con acuerdos y destino claros.
Una respuesta atenta puede ayudar más que reaccionar de inmediato.|Cuidar incluye límites y atención a tus necesidades.
Una decisión pide responsabilidad por recursos, criterios y consecuencias.|La autoridad no elimina escuchar y revisar el plan.`),
suit:rows(`Las Copas hablan de sentimientos, cercanía y expectativas emocionales. Pregunta qué se ha expresado y qué se está suponiendo.|Ejemplo: acordar cómo apoyaros después de un día difícil.
Los Oros hablan de apoyo práctico: dinero, tiempo, habilidades, hogar y trabajo compartido. Empieza con lo disponible.|Ejemplo: preparar costes y responsabilidades antes de una compra común.
Las Espadas hablan de ideas, palabras y decisiones. Separa lo observado de la historia que le has añadido.|Ejemplo: aclarar un mensaje breve antes de responder con enfado.
Los Bastos hablan de iniciativa, motivación y uso de la energía. Busca una meta y un ritmo sostenible.|Ejemplo: probar un proyecto pequeño antes de aceptar todas las tareas.`)
},
de:{
hook:['Geld, Liebe, Gesundheit und Familie: Beginnen Sie mit dem, was Ihnen wichtig ist.','Nutzen Sie Ihre Deutung, um Prioritäten zu klären, Gespräche vorzubereiten und einen machbaren nächsten Schritt zu wählen.'],
guide:['Neu in der Astrologie? Beginnen Sie mit Ihrem Geburtstag.','Mit dem Sternzeichen ist meist das Sonnenzeichen gemeint: das Zeichen, in dem die Sonne bei Ihrer Geburt stand. Diese Daten dienen als ungefähre Orientierung.','Nahe einem Zeichenwechsel geboren? Das genaue Zeichen hängt von Geburtsjahr und Uhrzeit ab. Der persönliche Bericht berechnet es anhand Ihrer Geburtsdaten.','Dieses Zeichen kennenlernen','Persönlichen Überblick erhalten · $9.99','Wählen Sie ein Zeichen für eine kurze Einführung. Das ändert keine Geburtsdaten und berechnet keine persönliche Vorhersage.'],
months:['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
labels:['Im Alltag','Worauf Sie achten können','Was Sie ausprobieren können','Geld und praktische Entscheidungen','Beziehungen und Familie','Erholung und Wohlbefinden','Was dieser Bericht enthält','So nutzen Sie Ihren Bericht','Ihr Sternzeichen ist erst der Anfang','Eine hilfreiche Frage','Eine mögliche Stärke','Wenn es schwierig wird'],
intro:'Ein Geburtshoroskop zeigt den Himmel zum Zeitpunkt der Geburt. Die folgenden Abschnitte erklären verschiedene Themen dieses Bildes. Vergleichen Sie sie mit Ihren Erfahrungen: Es sind Anregungen zum Nachdenken, keine feste Vorgabe dafür, wie Sie sein müssen.',
sign:rows(`Ein kleiner Versuch zeigt, ob eine Idee funktioniert. Erklären Sie bei gemeinsamen Vorhaben zuerst, was Sie ausprobieren möchten.|Eile kann das Tempo anderer oder zusätzliche Kosten überdecken.|Benennen Sie den ersten Schritt, den Zeitbedarf und einen Termin zur Auswertung.
Ein verlässlicher Rhythmus hilft beim Sparen, Lernen oder im Haushalt. Kleine Verbesserungen machen Fortschritt sichtbar.|Vertrautes zu bewahren kostet manchmal mehr Kraft als eine Änderung.|Behalten Sie eine hilfreiche Gewohnheit und testen Sie eine kleine Anpassung für eine Woche.
Verschiedene Meinungen können eine neue Frage sichtbar machen. Vielleicht erklären Sie Kompliziertes gern mit einfachen Worten.|Viele Gespräche und offene Aufgaben zerstreuen die Aufmerksamkeit.|Notieren Sie die Hauptfrage und beenden Sie einen Teil, bevor Sie Neues beginnen.
Ein Blick dafür, was Menschen willkommen heißt, stärkt Freundschaften und das Zusammenleben.|Ungefragte Hilfe kann eigene Bedürfnisse unausgesprochen lassen.|Fragen Sie, welche Hilfe gewünscht ist, und sagen Sie, was Sie wirklich anbieten können.
Eine persönliche Idee bringt Wärme in ein Projekt, ein Fest oder die Zeit mit Kindern.|Lob kann wichtiger werden als die Freude an der Tätigkeit.|Gestalten Sie etwas, das Ihnen gefällt, und bitten Sie um eine konkrete Rückmeldung.
Ein fehlendes Detail zu bemerken kann unnötige Arbeit vermeiden. Eine kurze Liste hilft allen Beteiligten.|Der Wunsch nach guter Arbeit kann zu ständiger Kritik werden.|Vereinbaren Sie, was für ein fertiges Ergebnis nötig ist; weitere Verbesserungen können warten.
Mehrere Sichtweisen zu erkennen hilft bei fairen Absprachen.|Streit zu vermeiden kann eine notwendige eigene Entscheidung verzögern.|Nennen Sie zuerst Ihren Wunsch und fragen Sie dann nach gemeinsamen Anpassungen.
Eine sorgfältige Frage bringt unausgesprochene Absprachen ans Licht und erleichtert Vertrauen.|Unsicherheit kann dazu verleiten, Nachrichten zu überdeuten oder Treue zu prüfen.|Trennen Sie Gesagtes, Vermutetes und das, was Sie direkt fragen können.
Neues Wissen erweitert den Blick, wenn eine Aufgabe zu eng erscheint.|Eine reizvolle Möglichkeit kann alltägliche Grenzen unwichtig wirken lassen.|Benennen Sie das große Ziel und einen bezahlbaren Versuch, bevor Sie sich festlegen.
Eine realistische Schrittfolge macht aus einem langen Projekt machbare Arbeit.|Verantwortung kann zur Gewohnheit werden, fremde Aufgaben zu übernehmen.|Listen Sie eigene Zusagen auf, teilen Sie eine gemeinsame Aufgabe und planen Sie Erholung.
Ein ungewöhnlicher Vorschlag kann ein bisher ungelöstes Problem angehen.|Auch eine gute Idee kann übersehen, wie viel Veränderung andere tragen können.|Testen Sie die Idee mit Betroffenen und fragen Sie nach einer leichteren Anwendung.
Vorstellungskraft hilft, ein Gefühl wahrzunehmen oder eine Erfahrung auszudrücken.|Fremde Belastung kann die Grenze der eigenen Verantwortung unklar machen.|Benennen Sie Ihr Gefühl, prüfen Sie Fakten und wählen Sie eine Grenze, die Fürsorge erlaubt.`),
planet:rows(`Identität und Richtung|Ein selbst gewähltes Ziel kann sich anders anfühlen als eines, das Erwartungen erfüllen soll.|Welche Entscheidung wäre mir auch ohne Lob wichtig?
Gefühle und vertraute Reaktionen|Ein anstrengender Tag kann Rückzug oder die Suche nach Bestätigung auslösen.|Wie kann ich um Unterstützung bitten, ohne Gedankenlesen zu erwarten?
Denken und Kommunikation|Ein Streit kann aus verschiedenen Bedeutungen desselben Wortes entstehen.|Welche Frage würde ein Missverständnis vermeiden?
Werte und Nähe|Zeit zu teilen oder Wertschätzung zu zeigen kann einen noch unbesprochenen Wunsch sichtbar machen.|Wie sage ich meinen Wunsch und lasse Raum für eine andere Antwort?
Handeln und Grenzen|Anfangen und Nein sagen brauchen Klarheit darüber, wofür Sie Kraft einsetzen möchten.|Wo brauche ich einen Anfang, wo einen Schlusspunkt?
Lernen und Möglichkeiten|Ein großer Plan wird nützlich, wenn Nutzen, Zeitbedarf und Mittel vergleichbar sind.|Welche kleine Erfahrung zeigt, ob der Plan passt?
Zusagen und Grenzen|Ein Versprechen lässt sich mit vereinbartem Umfang, Termin und Unterstützung leichter halten.|Wofür kann ich jetzt wirklich Verantwortung übernehmen?
Veränderung und Selbstständigkeit|Ein kleiner Versuch zeigt, ob eine andere Methode den Alltag verbessert.|Was kann ich vorübergehend statt endgültig ändern?
Vorstellungskraft und Unsicherheit|Eine anregende Möglichkeit und eine bestätigte Tatsache haben verschiedene Aufgaben.|Was weiß ich, und was muss ich noch prüfen?
Tiefer Wandel und gemeinsamer Einfluss|Eine alte Absprache kann ein neues Gespräch über Entscheidungen und Folgen brauchen.|Was kann ich beeinflussen, und was entscheidet jemand anderes?`),
house:rows(`Beobachten Sie, wie Sie Gespräche beginnen oder neue Räume betreten. Eine Vorstellung lässt sich ändern, ohne die ganze Persönlichkeit zu ändern.|Was erleichtert mir einen ruhigen ersten Kontakt?
Betrachten Sie Zeit, Besitz und verfügbares Geld gemeinsam. Eine hilfreiche Entscheidung passt zu Ihren wirklichen Mitteln.|Was kann ich an Geld, Zeit und Kraft aufbringen?
Klären Sie ein alltägliches Gespräch. Eine konkrete Bitte hilft oft mehr als eine Andeutung.|Was muss die andere Person verstehen?
Zuhause kann ein Ort, eine Beziehung oder eine verlässliche Gewohnheit sein. Was braucht praktische Aufmerksamkeit?|Welche kleine Absprache erleichtert das Zusammenleben?
Freude muss keine Leistung werden. Geben Sie Spiel, Hobby oder einem Versuch Raum, ohne sofort den Wert zu beurteilen.|Was würde ich gern um seiner selbst willen tun?
Sehen Sie einen gewöhnlichen Tag an: Arbeit, Essen, Pausen und offene Aufgaben. Wählen Sie eine machbare Änderung; dies ist keine Gesundheitsbewertung.|Welche Routine lässt sich vereinfachen?
Eine Partnerschaft braucht Platz für beide Erwartungen. Sprechen Sie eine Annahme aus und fragen Sie, ob sie geteilt wird.|Was haben wir vereinbart und was nur angenommen?
Klären Sie gemeinsame Pflichten, bevor Sie mehr zusagen. Besprechen Sie Zugang, Erlaubnis und Erwartungen bei gemeinsamen Mitteln.|Wer trägt für welchen Teil Verantwortung?
Ein Kurs, ein Buch oder fremde Erfahrung kann den Blick weiten. Vergleichen Sie die Idee mit Beobachtbarem.|Welche Überzeugung möchte ich überprüfen?
Eine öffentliche Rolle kann Beruf, Studium oder unbezahlte Verantwortung sein. Beschreiben Sie Erfolg durch überprüfbare Ergebnisse.|Wie würde Fortschritt praktisch aussehen?
Eine Gruppe braucht klare Beiträge und Grenzen. Zugehörigkeit verlangt keine ständige Erreichbarkeit.|Wo ist mein Beitrag gewünscht und dauerhaft machbar?
Ruhige Zeit hilft, Aufgaben abzuschließen oder Aufmerksamkeit zu sammeln. Alleinsein hilft, wenn Unterstützung erreichbar bleibt.|Was kann ich abschließen oder vorerst ablegen?`),
aspect:rows(`Zwei Themen werden gemeinsam betont. Nähe kann zum Beispiel mit dem Wunsch verbunden sein, gehört zu werden.|Benennen Sie beide Bedürfnisse einzeln, bevor Sie handeln.
Eine Möglichkeit braucht Aufmerksamkeit. Ein hilfreiches Gespräch kann vorbeigehen, wenn Sie nur abwarten.|Wählen Sie eine Frage, Einladung oder einen kleinen Versuch.
Zwei Prioritäten können dieselbe Zeit brauchen. Spannung zeigt möglicherweise eine Grenze oder eine überholte Absprache.|Verkleinern Sie den Schritt und setzen Sie heute eine Priorität.
Eine vertraute Stärke erleichtert die Aufgabe. Leichtigkeit garantiert nichts, und auch bequeme Gewohnheiten brauchen Prüfung.|Nutzen Sie Bewährtes und prüfen Sie, ob es hier passt.
Verschiedene Bedürfnisse können gegensätzlich wirken. Eine Beziehung macht Unterschiede sichtbar, ohne jemanden zum Problem zu machen.|Beschreiben Sie beide Seiten und suchen Sie eine machbare Grenze.`),
major:rows(`Ein Anfang gewinnt durch einen kleinen Versuch und eine klare Lernfrage.|Begeisterung ersetzt keine Vorbereitung.
Eine Fähigkeit, ein Kontakt oder ein ungenutztes Werkzeug könnte schon verfügbar sein.|Wählen Sie eine konkrete Aufgabe statt zu großer Versprechen.
Eine Pause zeigt vielleicht ein übersehenes Detail. Danach lohnt sich die Prüfung.|Schweigen beweist nicht, was jemand denkt.
Eine Idee, eine Beziehung oder der Alltag brauchen vielleicht geduldige Fürsorge.|Fürsorge verlangt nicht, alle Aufgaben zu übernehmen.
Klare Absprachen nennen Entscheidung, Arbeitsteilung und Zeitpunkt der Prüfung.|Ordnung hilft nicht mehr, wenn sie vernünftige Fragen verhindert.
Erfahrung oder eine bewährte Methode bieten einen Anfang.|Prüfen Sie Regeln, wenn sich Umstände ändern.
Eine wichtige Wahl zeigt Werte. Vergleichen Sie Wünsche mit haltbaren Zusagen.|Ein gutes Miteinander braucht Raum für Unterschiede.
Fortschritt braucht eine klare Richtung und einen Blick auf den eigenen Einfluss.|Mehr Druck löst keinen Streit über das Ziel.
Eine ruhige Grenze schützt Würde und Beziehung ohne Kraftbeweis.|Ruhe verpflichtet nicht dazu, Respektlosigkeit hinzunehmen.
Abstand vom Lärm hilft, die eigene Meinung zu hören und ein Gespräch zu wählen.|Alleinsein sollte den Weg zu Unterstützung offenlassen.
Neue Umstände laden zur Planänderung und zu einer tragfähigen Alternative ein.|Die Karte verspricht weder Glück noch Geldgewinn.
Eine ausgewogene Entscheidung braucht Fakten, Absprachen und Gehör für alle.|Sicherheit im Gefühl ersetzt keine ausreichenden Belege.
Eine Pause kann aktiv sein: Informationen sammeln oder anders hinsehen.|Warten kostet, wenn Grund und Prüftermin fehlen.
Ein Abschluss kann Trauer und Erleichterung bringen. Klären Sie Ende und nötige Hilfe.|Das Bild sagt keinen Tod voraus und verlangt keinen plötzlichen Bruch.
Zwei brauchbare Wege zu verbinden hilft manchmal mehr als ein Extrem.|Gleichgewicht ist persönlich und passt sich dem Tag an.
Bemerken Sie Absprachen, die Sie aus Druck, Gewohnheit oder Angst vor Missbilligung halten.|Die Karte ist kein Urteil über Menschen und kein Beleg für einen Fluch.
Wenn eine Annahme wankt, prüfen Sie zuerst, was weiterhin trägt.|Das Bild stellt keine bevorstehende Krise fest.
Ein kleiner Schritt oder angenommene Hilfe machen Hoffnung greifbar.|Sie müssen nicht ständig zuversichtlich sein, um weiterzugehen.
Unklare Nachrichten machen erfundene Erklärungen überzeugend. Fragen Sie direkt, wenn es passt.|Ein starkes Gefühl beweist keine Täuschung oder versteckte Gefahr.
Erkennen Sie ein gutes Ergebnis und das an, was dazu beigetragen hat.|Freude und ein Blick auf offene Arbeit passen zusammen.
Mehr Erfahrung kann eine fairere Antwort auf eine alte Frage ermöglichen.|Eine Entscheidung zu prüfen verlangt kein Urteil über das ganze Leben.
Eine abgeschlossene Phase bietet Erfahrung für die nächste. Würdigen Sie Hilfe und Schritte.|Abschluss bedeutet nicht, dass alles perfekt sein muss.`),
rank:rows(`Ein kleiner Anfang ist möglich. Benennen Sie, was ihn machbar macht.|Eine Möglichkeit garantiert kein Ergebnis.
Zwei Bedürfnisse oder Menschen sind beteiligt. Prüfen Sie Einigkeit und offene Wahl.|Schweigen kann verschiedene Erwartungen verdecken.
Etwas wächst durch Beiträge, Übung oder Unterstützung.|Klären Sie Rollen statt gemeinsames Verständnis vorauszusetzen.
Eine Pause oder feste Ordnung erlaubt eine Bestandsaufnahme.|Bequemlichkeit kann eine nötige Antwort vermeiden.
Eine Schwierigkeit braucht eine konkrete Antwort statt eines Urteils über die Zukunft.|Benennen Sie Problem und erreichbare Hilfe.
Ein Austausch zeigt, wo Unterstützung oder Anerkennung hilft.|Prüfen Sie Freiwilligkeit und Fairness beim Geben und Nehmen.
Vergleichen Sie Möglichkeiten nach Fakten, Aufwand und Folgen.|Auch eine reizvolle Erklärung braucht Prüfung.
Ein Richtungswechsel braucht vielleicht Übung oder das Ende einer alten Methode.|Benennen Sie das Ziel, nicht nur das, wovor Sie wegmöchten.
Erfahrung ist gewachsen. Erkennen Sie Ergebnis und Kraftaufwand an.|Lassen Sie Raum für Erholung und einen anderen nächsten Schritt.
Ein Muster erreicht eine Grenze oder einen Abschluss. Was bleibt, was endet?|Ein schweres Ende bestimmt nicht alle künftigen Ergebnisse.
Eine lernende Haltung hilft: fragen, beobachten, eine machbare Aufgabe versuchen.|Für eine klare Frage müssen Sie nicht alles wissen.
Kraft geht auf ein Ziel zu. Prüfen Sie Tempo, Richtung und Wirkung auf andere.|Tempo hilft bei klarer Absprache und Richtung.
Eine aufmerksame Antwort kann mehr helfen als sofortiges Reagieren.|Fürsorge umfasst Grenzen und eigene Bedürfnisse.
Eine Entscheidung braucht Verantwortung für Mittel, Maßstäbe und Folgen.|Autorität ersetzt weder Zuhören noch das Überarbeiten eines Plans.`),
suit:rows(`Kelche stehen für Gefühle, Nähe und emotionale Erwartungen. Was wurde ausgesprochen, was nur vermutet?|Alltagsbeispiel: vereinbaren, wie Sie sich nach einem schweren Tag unterstützen.
Münzen stehen für praktische Grundlagen: Geld, Zeit, Fähigkeiten, Zuhause und gemeinsame Arbeit. Beginnen Sie mit vorhandenen Mitteln.|Alltagsbeispiel: Kosten und Pflichten vor einem gemeinsamen Kauf aufschreiben.
Schwerter stehen für Gedanken, Worte und Entscheidungen. Trennen Sie Beobachtungen von Ihrer Erklärung.|Alltagsbeispiel: eine kurze Nachricht klären, bevor Sie verärgert antworten.
Stäbe stehen für Initiative, Antrieb und Krafteinsatz. Suchen Sie ein Ziel und ein tragbares Tempo.|Alltagsbeispiel: ein kleines Vorhaben testen, bevor Sie alle Aufgaben zusagen.`)
}
};
export const SIGN_DATES=[[3,21,4,19],[4,20,5,20],[5,21,6,20],[6,21,7,22],[7,23,8,22],[8,23,9,22],[9,23,10,22],[10,23,11,21],[11,22,12,21],[12,22,1,19],[1,20,2,18],[2,19,3,20]];
export function signDates(index,lang='en'){const [m,d,n,e]=SIGN_DATES[index],months=EDITORIAL[lang].months;return lang==='en'?`${months[m-1]} ${d} – ${months[n-1]} ${e}`:lang==='es'?`${d} de ${months[m-1]} – ${e} de ${months[n-1]}`:lang==='de'?`${d}. ${months[m-1]} – ${e}. ${months[n-1]}`:`${d} ${months[m-1]} – ${e} ${months[n-1]}`;}
