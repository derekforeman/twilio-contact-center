var app = angular.module('callcenterApplication', ['ngMessages', 'glue.directives']);

app.filter('time', function() {

  return function(value) {

    var minutes = Math.floor(value / 60);
    var seconds = value - (minutes * 60);

    if(minutes < 10){
      minutes = '0' + minutes;
    }

    if(seconds < 10){
      seconds = '0' + seconds;
    }

    return minutes + ':' + seconds;

  }

});

app.controller('WorkflowController', function ($scope, $rootScope, $http, $interval) {

  /* misc configuration data, for instance callerId for outbound calls */
  $scope.configuration;

  /* contains task data pushed by the TaskRouter JavaScript SDK */
  $scope.reservation;
  $scope.tasks;

  /* contains worker record received by the Twilio API or the TaskRouter JavaScript SDK */
  $scope.worker;

  /* TaskRouter Worker */
  $scope.workerJS;

  /* request configuration data and tokens from the backend */
  $scope.init = function () {

    $http.get('/api/agents/session')

      .then(function onSuccess(response) {

      /* keep a local copy of the configuration and the worker */
      $scope.configuration = response.data.configuration;

      /* initialize Twilio worker js with token received from the backend */
      $scope.initWorker(response.data.tokens.worker);

      /* initialize Twilio client with token received from the backend */
      $scope.$broadcast('InitializePhone', { token: response.data.tokens.phone});

      /* initialize Twilio IP Messaging client with token received from the backend */
      $scope.$broadcast('InitializeChat', { token: response.data.tokens.chat, identity: response.data.worker.friendlyName});

    }, function onError(response) { 
      
      /* session is not valid anymore */
      if(response.status = 403){
         window.location.replace('/callcenter/');
      } else {
        alert(JSON.stringify(response))
      }

    });

  }

  $scope.initWorker = function(token) {

    /* create TaskRouter Worker */
    $scope.workerJS = new Twilio.TaskRouter.Worker(token, true, $scope.configuration.twilio.workerIdleActivitySid, $scope.configuration.twilio.workerOfflineActivitySid);

    $scope.workerJS.on("ready", function(worker) {

      console.log('TaskRouter Worker: ready');

      $scope.worker = worker;

    });

    $scope.workerJS.on("reservation.created", function(reservation) {

      console.log('TaskRouter Worker: reservation.created');
      console.log(reservation);

      $scope.reservation = reservation;
      $scope.$apply();

      $scope.startReservationCounter();

    });

    $scope.workerJS.on("reservation.accepted", function(reservation) {

      console.log('TaskRouter Worker: reservation.accepted');
      console.log(reservation);

      $scope.task = reservation.task;
      $scope.task.completed = false;
      $scope.reservation = null;
      $scope.stopReservationCounter();

      $scope.$apply();

    });

    $scope.workerJS.on("reservation.timeout", function(reservation) {

      console.log('TaskRouter Worker: reservation.timeout');
      console.log(reservation);

      /* reset all data */
      $scope.reservation = null;
      $scope.task = null;
      $scope.$apply();

    });

    $scope.workerJS.on("reservation.rescinded", function(reservation) {

      console.log('TaskRouter Worker: reservation.rescinded');
      console.log(reservation);

      /* reset all data */
      $scope.reservation = null;
      $scope.task = null;
      $scope.$apply();

    });

    $scope.workerJS.on("reservation.canceled", function(reservation) {

      console.log('TaskRouter Worker: reservation.cancelled');
      console.log(reservation);

      $scope.reservation = null;
      $scope.task = null;
      $scope.$apply();

    });

    $scope.workerJS.on("activity.update", function(worker) {

      console.log('TaskRouter Worker: activity.update');
      console.log(worker);

      $scope.worker = worker;
      $scope.$apply();

    });

    $scope.workerJS.on("token.expired", function() {

      console.log('TaskRouter Worker: token.expired');

      $scope.reservation = null;
      $scope.task = null;
      $scope.$apply();

      /* the worker token expired, the agent shoud log in again, token is generated upon log in */
      window.location.replace('/callcenter/');

    });

  } 

  $scope.acceptReservation = function (reservation) {

    console.log('accept reservation with TaskRouter Worker JavaScript SDK');

    /* depending on the typ of taks that was created we handle the reservation differently */
    if(reservation.task.attributes.channel == 'chat'){

      reservation.accept(

        function(err, reservation) {

          if(err) {
            console.log(err);
            return;
          }

          $scope.chatIsVisible = true;
          $scope.$broadcast('ActivateChat', { channelSid: reservation.task.attributes.channelSid });

        });

    }

    if(reservation.task.attributes.channel == 'phone' && reservation.task.attributes.type == 'Inbound call'){

      console.log('dequeue reservation with  callerId: ' + $scope.configuration.twilio.callerId);
      reservation.dequeue($scope.configuration.twilio.callerId);

    }
    
    /* we accept the reservation and initiate a call to the customer's phone number */
    if(reservation.task.attributes.channel == 'phone' && reservation.task.attributes.type == 'Callback request'){

      reservation.accept(

        function(err, reservation) {

          if(err) {
            console.log(error);
            return;
          }  

          $scope.$broadcast('CallPhoneNumber', { phoneNumber: reservation.task.attributes.phone });

        });
    }
  };

  $scope.wrapup = function (reservation) {

    $scope.task.completed = true;

    if($scope.task.attributes.channel == 'chat'){
      $scope.$broadcast('DestroyChat');
    }

  }

  $scope.complete = function (reservation) {

    $scope.workerJS.update("ActivitySid", $scope.configuration.twilio.workerIdleActivitySid, function(err, worker) {

      if(err) {
        console.log(err);
        return;
      } 

      $scope.reservation = null;
      $scope.task = null;
      $scope.$apply();

    });

  };

  $scope.logout = function () {

    $http.post('/api/agents/logout')

     .then(function onSuccess(response) {

      window.location.replace("/callcenter/index.html");

    }, function onError(response) { 

      console.log(data);

    })

  };

  $scope.startReservationCounter = function() {

    console.log('start reservation counter');
    $scope.reservationCounter = $scope.reservation.task.age;

    $scope.reservationInterval = $interval(function() {
     $scope.reservationCounter++;
    }, 1000);

  };

  $scope.stopReservationCounter = function() {

    if (angular.isDefined($scope.reservationInterval)) {
      $interval.cancel($scope.reservationInterval);
      $scope.reservationInterval = undefined;
    }
    
  };

});  


  