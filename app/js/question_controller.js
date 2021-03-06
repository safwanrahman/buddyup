'use strict';

/* global _, asyncStorage, SumoDB, Utils, User, nunjucks */

(function(exports) {
  var question_thread;
  var suggestions;
  var thread_introduction;
  var question_id;

  var question_field;

  var question_object;
  var solution_id;

  function handle_event(evt) {
    var elem = evt.target;

    var answer_id = null;
    var node = elem.parentNode;
    while (node) {
      if (node.dataset.id) {
        answer_id = node.dataset.id;
        node = null;
      } else {
        node = node.parentNode;
      }
    }

    if (elem.classList.contains('js-vote')) {
      return handle_helpful_votes(elem, answer_id);
    }
    if (elem.classList.contains('js-solve')) {
      return handle_solving(elem, answer_id);
    }
  }

  function handle_helpful_votes(elem, answer_id) {
    SumoDB.submit_vote(answer_id).then(function(response) {
      elem.classList.add('active');

      if (response.num_helpful_votes) {
        elem.textContent = response.num_helpful_votes;
      } else if (response.message === 'CONFLICT') {
        // Do nothing, user has already voted
      }
    });
  }

  function handle_solving(elem, answer_id) {
    var confirm_solve = document.getElementById('confirm_solve');
    confirm_solve.classList.remove('hide');

    confirm_solve.addEventListener('click', function(evt) {
      if (!evt.target.classList.contains('recommend')) {
        return;
      }
      SumoDB.solve_question(question_id, answer_id).then(function(response) {
        var p = document.createElement('p');
        p.textContent = 'Solution ✓';
        p.classList.add('is_solution');
        elem.parentNode.replaceChild(p, elem);
      });
    });

  }

  function close_question() {
    document.getElementById('question_form').classList.add('hide');
  }

  /**
   * Handles close button events from a dialog modal.
   */
  function close_dialog_handler() {
    var dialogs = document.querySelectorAll('form[data-type="confirm"]');
    function close_dialog(evt) {
      evt.preventDefault();
      evt.target.classList.add('hide');
    }
    for (var dialog of dialogs) {
      dialog.addEventListener('submit', close_dialog);
    }
  }

  /**
  * Adds the thread header that displays, the relative time the question was
  * posted, the device (if already categorised) and the display name of the
  * user who posted the question.
  * @param {object} question - The question JSON object
  */
  function add_thread_header(question) {
    var handset_type;
    var date_posted = Utils.time_since(new Date(question.updated));
    var author = question.creator.display_name || question.creator.username;

    for (var i = 0, l = question.metadata.length; i < l; i++) {
      var current_item = question.metadata[i];
      if (current_item.name === 'handset_type') {
        handset_type = current_item.value;
        break;
      }
    }
    var html = nunjucks.render('thread_header.html', {
      date_posted: date_posted,
      handset_type: handset_type,
      author: author
    });
    question_thread.insertAdjacentHTML('afterbegin', html);
  }

  function submit_comment(evt) {
    evt.preventDefault();
    var comment = question_field.value;

    Utils.toggle_spinner();

    show_panel(question_thread);

    var fake_comment = nunjucks.render('comment.html',
      {comment: {content: comment}});
    var list = document.getElementById('comment-list');
    var list_item = document.createElement('li');

    list.appendChild(list_item).innerHTML += fake_comment;
    User.get_user().then(function(user) {
      var is_helper = question_object &&
        user.username !== question_object.creator.username;
      if (is_helper) {
        list_item.classList.add('helper-comment');
      }
      list_item.scrollIntoView();

      var submit_promise;
      if (question_id) {
        submit_promise = submit_answer(question_id, comment);
      } else {
        submit_promise = submit_question(comment).then(function(comment) {

          add_thread_header(comment);

          comment.content = comment.title;
          return comment;
        });
      }
      return submit_promise;
    }).then(function(comment) {

      Utils.toggle_spinner();

      question_field.value = '';

      // Only handle first time help message scenario for questions
      if (comment.answers) {
        asyncStorage.getItem('seen_first_question_help').then(function(response) {
          // See if the flag exist
          if (!response) {
            // flag does not exist, show the dialog and set the flag
            var dialog = document.querySelector('#first_question_help');
            dialog.classList.remove('hide');
            asyncStorage.setItem('seen_first_question_help', true);
          }
        });
      }

      comment.created = Utils.time_since(new Date(comment.created));
      comment.author = comment.creator.display_name || comment.creator.username;
      list_item.innerHTML = nunjucks.render('comment.html', {
        comment: comment,
        is_my_question: question_object.creator.username === user.username,
        user: user
      });

      window.top.postMessage({question_id: question_id, comment: comment}, '*');
    });
  }

  function submit_question(comment) {
    var user_meta = Utils.get_user_meta();
    return SumoDB.post_question(comment, user_meta).then(function(response) {
      question_id = response.id;
      return response;
    });
  }

  function submit_answer(question_id, comment) {
    return SumoDB.post_answer(question_id, comment).then(function(response) {
      return response;
    });
  }

  function load_question() {
    if (!question_id) {
      Utils.toggle_spinner();
      return;
    }

    show_panel(question_thread);

    var question_content = [];
    question_content.push(SumoDB.get_question(question_id));

    question_content.push(SumoDB.get_answers_for_question(question_id));

    Promise.all(question_content).
      then(check_if_taken).
      then(display_question).catch(function(err) {
        // We're just catching the taken case
      });
  }

  function check_if_taken([question, answers]) {
    return User.get_user().then(function(user) {
      if (!question.taken_by || question.taken_by.username == user.username) {
        return [question, answers];
      }

      var dialog = document.getElementById('already_taken');
      dialog.classList.remove('hide');
      dialog.addEventListener('submit', function(evt) {
        history.back();
      });
      throw new Error('Already taken');
    });
  }

  function display_question([question, answers]) {
    Utils.toggle_spinner();

    question_object = question;
    solution_id = question.solution;
    if (solution_id) {
      close_question();
    }

    question.content = question.title;
    answers.push(question);
    answers.reverse();

    for (var i = 0, l = answers.length; i < l; i++) {
      var created = answers[i].created;
      answers[i].author = answers[i].creator.display_name ||
        answers[i].creator.username;
      answers[i].created = Utils.time_since(new Date(created));
    }

    add_thread_header(question);
    User.get_user().then(function(user) {
      var html = nunjucks.render('thread.html', {
        author: question.creator.display_name || question.creator.username,
        user: user,
        is_my_question: question.creator.username === user.username,
        solution_id: solution_id,
        results: answers
      });
      var list = document.getElementById('comment-list');
      list.insertAdjacentHTML('beforeend', html);
    });
  }

  function take_question(evt) {
    if (evt.target.value.length !== 1) {
      return;
    }
    if (!question_id) {
      return;
    }

    User.get_user().then(function(user) {
      var is_helper = user.username !== question_object.creator.username;
      if (is_helper) {
        SumoDB.take_question(question_id);
      }
    });
  }

  function show_panel(elt) {
    var panels = [question_thread, suggestions, thread_introduction];
    panels.forEach(function(panel) {
      if (panel == elt) {
        panel.classList.remove('hide');
      } else {
        panel.classList.add('hide');
      }
    });
  }

  function give_suggestions(evt) {
    if (question_id) {
      return;
    }

    if (evt.target.value.length < 3) {
      show_panel(thread_introduction);
      return;
    }

    SumoDB.get_suggestions(evt.target.value, function(response) {
      if (response.questions.length + response.documents.length === 0) {
        show_panel(thread_introduction);
        return;
      }

      var kb_items = response.documents.map(function(kb_item) {
        return nunjucks.render('kb_item.html', {
          kb_item: kb_item
        });
      });
      var question_items = response.questions.map(function(question_item) {
        return nunjucks.render('question.html', {
          question: question_item
        });
      });

      suggestions.querySelector('ul').innerHTML =
        kb_items.concat(question_items).join('');
      show_panel(suggestions);
    });
  }

  var QuestionController = {
    init: function() {
      question_field = document.getElementById('question_field');
      question_field.addEventListener('input', take_question);
      question_field.addEventListener('input',
        _.throttle(give_suggestions, 500, {leading: false}));

      var form = document.getElementById('question_form');
      form.addEventListener('submit', submit_comment);

      question_thread = document.getElementById('question-thread');
      question_thread.addEventListener('click', handle_event);
      suggestions = document.getElementById('suggestions');
      thread_introduction = document.getElementById('thread-introduction');

      // handle dialog close events
      close_dialog_handler();

      var question_view = location.search ? true : false;
      if (question_view) {
        var params = Utils.get_url_parameters(location);
        if (params.id) {

          Utils.toggle_spinner();

          question_id = params.id;
          load_question();
        }
      }
    }
  };
  exports.QuestionController = QuestionController;
  QuestionController.init();

})(window);
