# AWS WRAPPERS #

When you have many Lambda functions you will find yourself writing the same code a few times. Instead of doing that you should write a private package that you could share around your applications.

### WHAT TO KNOW? ###

In this repository, I wanted to show just a few examples of wrapper SQS and [Kinesis]( https://bitbucket.org/DanBranch/kinesis/src/master/). 
I have picked them up because when you are using them you should use the batch operations that AWS SDK has.
Once you start using batch operations a common mistake is to believe that AWS SDK will make sure that every single item in the batch will be successfully delivered but in reality, AWS SDK retries the request on your behalf if the service is unavailable or other 5xx error.
 
### PARTIAL FAILURE ###

The batch request will go through successfully and if you check the output result of AWS SQS and AWS Kinesis you will see that you have a reference to failed records and this means that part of your records could not be delivered and if you are not looking at this result you could lose precious data.

### SOLUTION ###

No matter what you will do, you will have at some point some failure so you should try to handle this failure somehow. What I did and you can find in the code of this repository is a basic retry with a delay between requests, but it is enough to get you started.

### WHAT IS MISSING ###

If you arrive and the end of your retries attempts and there are still failures, I think you should save them in a DLQ.
